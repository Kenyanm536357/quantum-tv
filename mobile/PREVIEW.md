# Visual Preview (mobile)

This screen (`/preview`) provides a quick visual check of image rendering, hairline borders, and focus state.

How to run locally

1. Start Expo in the `mobile` folder:

```bash
cd mobile
yarn install
yarn start
```

2. Open the app in a simulator or device using Expo DevTools. To open the preview screen directly, navigate to the route `/preview` in the app (expo-router will map `app/preview.tsx`).

Notes

- This project uses `react-native-tvos` so previewing on a TV emulator (or running with `expo start` and connecting a device) gives best fidelity.
- Use the `ImageWithFallback` component in your app to reduce missing-image artifacts.
