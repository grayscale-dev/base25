import ApiDocs from './pages/ApiDocs';
import Changelog from './pages/Changelog';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Landing from './pages/Landing';
import PublicWorkspaceSelector from './pages/PublicWorkspaceSelector';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';
import WorkspaceSelector from './pages/WorkspaceSelector';
import WorkspaceSettings from './pages/WorkspaceSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ApiDocs": ApiDocs,
    "Changelog": Changelog,
    "Feedback": Feedback,
    "Home": Home,
    "Landing": Landing,
    "PublicWorkspaceSelector": PublicWorkspaceSelector,
    "Roadmap": Roadmap,
    "Support": Support,
    "WorkspaceSelector": WorkspaceSelector,
    "WorkspaceSettings": WorkspaceSettings,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};