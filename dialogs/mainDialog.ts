import { StatePropertyAccessor, TurnContext, UserState } from "botbuilder";
import { ChoicePrompt, ComponentDialog, DialogSet, DialogTurnStatus, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI } from "@langchain/openai";
import { MainEmailDialog, EMAIL_DIALOG } from "./emailDialog/mainEmailDialog";

const MAIN_DIALOG = 'MAIN_DIALOG';
const CHOICE_PROMPT = 'CHOICE_PROMPT';
const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

export class MainDialog extends ComponentDialog {

  constructor (userState: UserState, model: ChatOpenAI) {
    super(MAIN_DIALOG);

    this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
    this.addDialog(new MainEmailDialog(userState, model));

    this.addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
      this.initialStep.bind(this),
      this.selectionStep.bind(this),
      this.finalStep.bind(this)
    ]));

    // The initial child Dialog to run.
    this.initialDialogId = MAIN_WATERFALL_DIALOG;
  }

  /**
     * 1. Prompts the user if the user is not in the middle of a dialog.
     * 2. Re-prompts the user when an invalid input is received.
     *
     * @param {WaterfallStepContext} stepContext
     */
  public async initialStep(stepContext: WaterfallStepContext) {
    console.log('MainDialog');

    // Create the PromptOptions which contain the prompt and re-prompt messages.
    // PromptOptions also contains the list of choices available to the user.
    const options = {
        choices: this.getChoices(),
        prompt: 'What do you want to do?',
        retryPrompt: 'That was not a valid choice, try again'
    };

    // Prompt the user with the configured PromptOptions.
    return await stepContext.prompt(CHOICE_PROMPT, options);
  }

  public async selectionStep(stepContext: WaterfallStepContext) {
    console.log(stepContext.result.value);
    if (stepContext.result.value === 'email')
      return await stepContext.beginDialog(EMAIL_DIALOG);

    return await stepContext.endDialog();
  }

  public async finalStep(stepContext: WaterfallStepContext) {
    await stepContext.context.sendActivity("Type anything to see more options.");
    return await stepContext.endDialog();
  }

  /**
     * Create the choices with synonyms to render for the user during the ChoicePrompt.
     * (Indexes and upper/lower-case variants do not need to be added as synonyms)
     */
  public getChoices() {
    const cardOptions = [
        {
          synonyms: ['email helper'],
          value: 'email'
        }
    ];

    return cardOptions;
  }
  
  /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
  public async run(turnContext: TurnContext, accessor: StatePropertyAccessor) {
    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(turnContext);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
        await dialogContext.beginDialog(this.id);
    }
}
}