import { Devvit, SettingScope, Participant } from '@devvit/public-api';
import LogModmailMessage from './triggers/modmail.js';
import LogPostReport from './triggers/postReports.js';
import LogCommentDefinition from './triggers/commentReports.js';
import Settings from './settings.js';

Devvit.configure({ redditAPI: true, modLog: true, http: true });

Devvit.addTrigger(LogModmailMessage);
Devvit.addTrigger(LogPostReport);
Devvit.addTrigger(LogCommentDefinition);


Devvit.addSettings(Settings);




export default Devvit;
