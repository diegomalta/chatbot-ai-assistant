import { ChoicePrompt, ComponentDialog, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { EmailDetails } from "./emailDetails";

export const COMPOSER_EMAIL_DIALOG = 'COMPOSER_EMAIL_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const CHOICE_PROMPT = 'CHOICE_PROMPT';

export class ComposerEmailDialog extends ComponentDialog {

  private outputParser: StringOutputParser;
  private model: ChatOpenAI;
  private prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert email writer who 
                guarantees that all emails are precise, grammatically correct, and easy to understand. 
                The user will provide the type of formality and the email text to be corrected; 
                your work is to analyze and fix the provided email.`],
    ["human", "Formality: {formality}, email: {email}"]
  ]);

  constructor(model: ChatOpenAI) {
    super(COMPOSER_EMAIL_DIALOG);

    this.model = model;
    this.outputParser = new StringOutputParser();

    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));

    this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
      this.generatingResponseStep.bind(this),
      this.confirmStep.bind(this)
    ]));


    this.initialDialogId = WATERFALL_DIALOG;
  }

  private async generatingResponseStep(stepContext: WaterfallStepContext<EmailDetails>) {
    const emailDetails = stepContext.options;

    const modelResponse = await this.getModelResponse(emailDetails.userText, emailDetails.formality);
    await stepContext.context.sendActivity(modelResponse);

    const options = {
      choices: this.getChoices(),
      prompt: 'What to do next?',
      retryPrompt: 'That was not a valid choice, try again'
    };

    return  await stepContext.prompt(CHOICE_PROMPT, options);
  }

  private async confirmStep(stepContext: WaterfallStepContext<EmailDetails>) {

    stepContext.result.value
    const emailDetails = stepContext.options;

    if (stepContext.result.value === 'tryagain') {
      return await stepContext.endDialog("tryagain");
    }

    if (stepContext.result.value === 'done') {
      return await stepContext.endDialog();
    }

    emailDetails.formality = stepContext.result.value
    return stepContext.replaceDialog(COMPOSER_EMAIL_DIALOG, emailDetails);
  }

  private async getModelResponse (email: string, formality: string): Promise<string> {
    const chain = this.prompt.pipe(this.model).pipe(this.outputParser);
    
    return await chain.invoke({ 
      email: email,
      formality: formality
    });
  }

  private getChoices() {
    return [
        {
          synonyms: ['All good'],
          value: 'done'
        },
        {
          synonyms: ['make it formal'],
          value: 'formal'
        },
        {
          synonyms: ['make it friendly'],
          value: 'friendly'
        },
        {
          synonyms: ['Try again'],
          value: 'tryagain'
        }
    ];
  }

  
}
