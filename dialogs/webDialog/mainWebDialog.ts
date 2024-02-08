
import { UserState } from "botbuilder";
import { ComponentDialog, TextPrompt, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const WEB_DIALOG = 'WEB_DIALOG';
const WEB_TEXT_PROMPT = 'WEB_TEXT_PROMPT';
const QUESTION_TEXT_PROMPT = 'QUESTION_TEXT_PROMPT';

export class MainWebDialog extends ComponentDialog {

  private model: ChatOpenAI;

  private docs: Document<Record<string, any>>[];
  private splitDocs: Document<Record<string, any>>[];
  private vectorstore: MemoryVectorStore;

  constructor(userState: UserState, model: ChatOpenAI) {
    super(WEB_DIALOG);

    this.model = model;
    this.addDialog(new TextPrompt(WEB_TEXT_PROMPT));
    this.addDialog(new TextPrompt(QUESTION_TEXT_PROMPT));

    this.addDialog(new WaterfallDialog(WEB_DIALOG, [
      this.initialStep.bind(this),
      this.webLoaderStep.bind(this),
      this.splitDocumentsStep.bind(this),
      this.vectorStoreStep.bind(this),
      this.questionStep.bind(this),
      this.responseQuestionStep.bind(this)
    ]));

    this.initialDialogId = WEB_DIALOG;
  };

  private async initialStep(stepContext: WaterfallStepContext) {
    const promptOptions = { prompt: 'Please enter a valid url' };
    return await stepContext.prompt(WEB_TEXT_PROMPT, promptOptions);
  }

  private async webLoaderStep(stepContext: WaterfallStepContext) {
    const url = stepContext.result;
    console.log(url);

    const loader = new CheerioWebBaseLoader(      
      url
    );

    await stepContext.context.sendActivity('Loading Webpage Content...');

    this.docs = await loader.load();

    return await stepContext.next();
  }

  private async splitDocumentsStep(stepContext: WaterfallStepContext) {
    await stepContext.context.sendActivity('Splitting Content...');

    const splitter = new RecursiveCharacterTextSplitter();
    this.splitDocs = await splitter.splitDocuments(this.docs);

    return await stepContext.next();
  }

  private async vectorStoreStep(stepContext: WaterfallStepContext) {
    await stepContext.context.sendActivity('initializing Vector Store...');

    const embeddings = new OpenAIEmbeddings();
    this.vectorstore = await MemoryVectorStore.fromDocuments(
      this.splitDocs,
      embeddings
    );

    return await stepContext.next();
  }

  private async questionStep(stepContext: WaterfallStepContext) {
    const promptOptions = { prompt: 'Ready, type your question' };
    return await stepContext.prompt(QUESTION_TEXT_PROMPT, promptOptions);
  }

  private async responseQuestionStep(stepContext: WaterfallStepContext) {
    console.log(stepContext.result)
    const documentChain = await createStuffDocumentsChain({
      llm: this.model,
      prompt: ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

      <context>
      {context}
      </context>
    
      Question: {input}`),
      outputParser: new StringOutputParser()
    });

    const retriever = this.vectorstore.asRetriever();

    const retrievalChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    const result = await retrievalChain.invoke({
      input: stepContext.result,
    });
    
    await stepContext.context.sendActivity(result.answer);

    return await stepContext.endDialog();
  }

  private async finalStep(stepContext: WaterfallStepContext) {
    return await stepContext.endDialog();
  }
}
