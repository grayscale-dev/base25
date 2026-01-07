import WorkspaceSelector from './pages/WorkspaceSelector';
import Feedback from './pages/Feedback';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';


export const PAGES = {
    "WorkspaceSelector": WorkspaceSelector,
    "Feedback": Feedback,
    "Roadmap": Roadmap,
    "Support": Support,
}

export const pagesConfig = {
    mainPage: "WorkspaceSelector",
    Pages: PAGES,
};