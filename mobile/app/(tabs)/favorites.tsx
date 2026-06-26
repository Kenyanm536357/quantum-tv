import ListScreen from "../../src/ListScreen";
import client from "../../src/api";
export default function Favorites() {
  return (
    <ListScreen
      endpoint="/me/favorites"
      title="Favorites"
      removeLabel="unfavorite"
      removeFromList={(rk: string) => client.delete(`/me/favorites/${rk}`)}
      emptyText={"No favorites yet.\nTap the heart on any title to add it here."}
    />
  );
}
