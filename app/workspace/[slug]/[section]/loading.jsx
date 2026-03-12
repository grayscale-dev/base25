import PageLoadingState from "@/components/common/PageLoadingState";
import { WORKSPACE_LOADING_COPY } from "@/lib/workspace-loading";

export default function WorkspaceSectionLoading() {
  return <PageLoadingState fullHeight text={WORKSPACE_LOADING_COPY} className="bg-slate-50" />;
}
