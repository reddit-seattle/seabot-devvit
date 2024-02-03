import { Devvit, SettingScope, Participant } from '@devvit/public-api';
import LogModmailMessage from './triggers/modmail';
import LogPostReport from './triggers/postReports';
import LogCommentDefinition from './triggers/commentReports';
import Settings from './settings';

Devvit.configure({ redditAPI: true, modLog: true, http: true });

Devvit.addTrigger(LogModmailMessage);
Devvit.addTrigger(LogPostReport);
Devvit.addTrigger(LogCommentDefinition);


Devvit.addSettings(Settings);




export default Devvit;
