
import { UserState } from "botbuilder";
import { ComponentDialog, TextPrompt, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";

export const WEB_DIALOG = 'WEB_DIALOG';
const WEB_TEXT_PROMPT = 'WEB_TEXT_PROMPT';

export class MainWebDialog extends ComponentDialog {

  private model: ChatOpenAI;

  constructor(userState: UserState, model: ChatOpenAI) {
    super(WEB_DIALOG);

    this.model = model;
    this.addDialog(new TextPrompt(WEB_TEXT_PROMPT));

    this.addDialog(new WaterfallDialog(WEB_DIALOG, [
      this.initialStep.bind(this),
      this.webLoaderStep.bind(this)
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

    // https://docs.smith.langchain.com/overview
    const loader = new CheerioWebBaseLoader(      
      url
    );

    await stepContext.context.sendActivity('loading webpage, give me some time.....');

    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter();
    const splitDocs = await splitter.splitDocuments(docs);

    const embeddings = new OpenAIEmbeddings();
    const vectorstore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );

    const documentChain = await createStuffDocumentsChain({
      llm: this.model,
      prompt: ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

      <context>
      {context}
      </context>
    
      Question: {input}`)
    });


    const retriever = vectorstore.asRetriever();

    const retrievalChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    const result = await retrievalChain.invoke({
      input: "what is LangSmith?",
    });
    
    console.log(result.answer);

    await stepContext.context.sendActivity(result.answer);



    return await stepContext.endDialog();
  }

  private async finalStep(stepContext: WaterfallStepContext) {
    return await stepContext.endDialog();
  }



}
