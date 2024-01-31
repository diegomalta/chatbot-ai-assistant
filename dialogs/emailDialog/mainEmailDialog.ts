import { StatePropertyAccessor, TurnContext, UserState } from "botbuilder";
import { ChoicePrompt, ComponentDialog, DialogSet, DialogState, DialogTurnStatus, TextPrompt, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { COMPOSER_EMAIL_DIALOG, ComposerEmailDialog} from './composerEmailDialog';
import { EmailDetails } from "./emailDetails";

export const EMAIL_DIALOG = 'EMAIL_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const EMAIL_TEXT_PROMPT = 'EMAIL_TEXT_PROMPT';
const CHOICE_PROMPT = 'CHOICE_PROMPT';
const EMAIL_DATA = 'EMAIL_DATA'

export class MainEmailDialog extends ComponentDialog {

  private emailDialogState: StatePropertyAccessor<EmailDetails>;
  private model: ChatOpenAI;
  private prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert email writer who guarantees that all emails are precise, grammatically correct, and easy to understand. The user will provide the type of formality and the email text to be corrected; your work is to analyze and fix the provided email."],
    ["user", "Formality: {formality}, email: {email}"]
  ]);
  private outputParser: StringOutputParser;

  constructor(userState: UserState, model: ChatOpenAI) {
    super(EMAIL_DIALOG);

    this.emailDialogState = userState.createProperty(EMAIL_DATA);

    this.model = model;
    this.outputParser = new StringOutputParser();
    this.addDialog(new ComposerEmailDialog(model));
    this.addDialog(new TextPrompt(EMAIL_TEXT_PROMPT));
    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));

    this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
      this.emailTextStep.bind(this),
      this.composerStep.bind(this),
      this.finalStep.bind(this)
    ]));
    
    this.initialDialogId = WATERFALL_DIALOG;
  }

  private async emailTextStep(stepContext: WaterfallStepContext<EmailDetails>) {
    const promptOptions = { prompt: 'Please enter your email idea.' };
    return await stepContext.prompt(EMAIL_TEXT_PROMPT, promptOptions);
  }

  private async composerStep(stepContext: WaterfallStepContext<EmailDetails>) {
    const emailDetails = new EmailDetails();
    emailDetails.userText = stepContext.result;
    emailDetails.formality = 'neutral';
    return await stepContext.beginDialog(COMPOSER_EMAIL_DIALOG, emailDetails);
  }

  private async finalStep(stepContext: WaterfallStepContext<EmailDetails>) {
    if (stepContext.result === 'tryagain') {
      return stepContext.replaceDialog(EMAIL_DIALOG);
    }
    
    return await stepContext.endDialog();
  }

  private async confirmStep(stepContext: WaterfallStepContext<EmailDetails>) {

    stepContext.result.value

    if (stepContext.result.value === 'friendly') {      
      return stepContext.replaceDialog(EMAIL_DIALOG);
    }
      

    return await stepContext.endDialog();
  }

  private async getModelResponse (email: string, formality: string): Promise<string> {
    const chain = this.prompt.pipe(this.model).pipe(this.outputParser);
    
    return await chain.invoke({ 
      email: email,
      formality: formality
    });
  }

  private getChoices() {
    const cardOptions = [
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
          value: 'tyragain'
        }
    ];

    return cardOptions;
  }

}