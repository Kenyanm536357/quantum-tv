import ListScreen from "../../src/ListScreen";
import client from "../../src/api";
export default function Watchlist() {
  return (
    <ListScreen
      endpoint="/me/watchlist"
      title="Watchlist"
      removeLabel="remove"
      removeFromList={(rk: string) => client.delete(`/me/watchlist/${rk}`)}
      emptyText={"Your watchlist is empty.\nTap the bookmark on any movie to add it."}
    />
  );
}
