/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/browse` | `/(tabs)/favorites` | `/(tabs)/livetv` | `/(tabs)/more` | `/(tabs)/movies` | `/(tabs)/search` | `/(tabs)/series` | `/(tabs)/watchlist` | `/_sitemap` | `/browse` | `/favorites` | `/livetv` | `/login` | `/more` | `/movies` | `/preview` | `/search` | `/series` | `/watchlist`;
      DynamicRoutes: `/player/${Router.SingleRoutePart<T>}` | `/show/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/player/[rk]` | `/show/[rk]`;
    }
  }
}
