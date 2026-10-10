import ListScreen from "../../src/ListScreen";
import client from "../../src/api";
export default function Favorites() {
  return (
    <ListScreen
      endpoint="/me/favorites"
      additionalEndpoints={["/me/live/favorites"]}
      title="Favorites"
      removeLabel="unfavorite"
      removeFromList={(item: any) => item.favorite_source === "live"
        ? client.delete(`/me/live/favorites/${encodeURIComponent(String(item.rating_key))}`)
        : client.delete(`/me/favorites/${encodeURIComponent(String(item.rating_key))}`)}
      emptyText={"No favorites yet.\nFavorite any movie, show, episode, or live channel to add it here."}
    />
  );
}
