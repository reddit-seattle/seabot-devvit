import LogCommentReport from './commentReports.js';
import LogModmailMessage from './modmail.js';
import AddCommentToRestrictedFlairPost from './postFlair.js';
import LogPostReport from './postReports.js';

export const triggers: any[] = [
    LogCommentReport,
    LogModmailMessage,
    AddCommentToRestrictedFlairPost,
    LogPostReport,
];