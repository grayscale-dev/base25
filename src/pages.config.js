import ApiDocs from './pages/ApiDocs';
import Changelog from './pages/Changelog';
import Docs from './pages/Docs';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import JoinWorkspace from './pages/JoinWorkspace';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';
import WorkspaceSettings from './pages/WorkspaceSettings';
import Workspaces from './pages/Workspaces';
import About from './pages/About';
import Pricing from './pages/Pricing';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ApiDocs": ApiDocs,
    "Changelog": Changelog,
    "Docs": Docs,
    "Feedback": Feedback,
    "Home": Home,
    "JoinWorkspace": JoinWorkspace,
    "Roadmap": Roadmap,
    "Support": Support,
    "WorkspaceSettings": WorkspaceSettings,
    "Workspaces": Workspaces,
    "About": About,
    "Pricing": Pricing,
}

export const pagesConfig = {
    mainPage: "ApiDocs",
    Pages: PAGES,
    Layout: __Layout,
};