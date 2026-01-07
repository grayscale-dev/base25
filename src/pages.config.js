import WorkspaceSelector from './pages/WorkspaceSelector';
import Feedback from './pages/Feedback';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';
import WorkspaceSettings from './pages/WorkspaceSettings';
import ApiDocs from './pages/ApiDocs';
import Home from './pages/Home';
import Landing from './pages/Landing';
import PublicWorkspaceSelector from './pages/PublicWorkspaceSelector';
import Changelog from './pages/Changelog';
import __Layout from './Layout.jsx';


export const PAGES = {
    "WorkspaceSelector": WorkspaceSelector,
    "Feedback": Feedback,
    "Roadmap": Roadmap,
    "Support": Support,
    "WorkspaceSettings": WorkspaceSettings,
    "ApiDocs": ApiDocs,
    "Home": Home,
    "Landing": Landing,
    "PublicWorkspaceSelector": PublicWorkspaceSelector,
    "Changelog": Changelog,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};