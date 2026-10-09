import ListScreen from "../../src/ListScreen";
import client from "../../src/api";
export default function Watchlist() {
  return (
    <ListScreen
      endpoint="/me/watchlist"
      title="Watchlist"
      removeLabel="remove"
      removeFromList={(item: { rating_key: string }) => client.delete(`/me/watchlist/${encodeURIComponent(String(item.rating_key))}`)}
      emptyText={"Your watchlist is empty.\nTap the bookmark on any movie or TV show to add it."}
    />
  );
}
