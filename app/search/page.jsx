import RoutePage from "@/components/RoutePage";
import Search from "@/screens/Search";
import { requireServerAuth } from "@/lib/auth/server-guard";

export default async function SearchPage() {
  await requireServerAuth("/search");
  return (
    <RoutePage currentPageName="Search">
      <Search />
    </RoutePage>
  );
}
