import { ChoicePrompt, ComponentDialog, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
import { ChatOpenAI } from "@langchain/openai";

export const REPLIER_WEB_DIALOG = 'REPLIER_WEB_DIALOG';

export class ReplierWebDialog extends ComponentDialog {

  private model: ChatOpenAI;

  constructor(model: ChatOpenAI) {
    super(REPLIER_WEB_DIALOG);

    this.model = model;
    

    this.addDialog(new WaterfallDialog(REPLIER_WEB_DIALOG, [
      
    ]));

    this.initialDialogId = REPLIER_WEB_DIALOG;        
  }


}