import React, { useState } from "react";
import {
  Image,
  ImageProps,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { hairline } from "./hairline";

type Props = Omit<ImageProps, "source"> & {
  source: ImageSourcePropType;
  fallbackSource?: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  showLoader?: boolean;
};

const ImageWithFallback: React.FC<Props> = ({
  source,
  fallbackSource,
  style,
  showLoader = false,
  ...rest
}) => {
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use fallback when an error occurs. For iOS `defaultSource` can be used
  // to reserve space while loading; on Android we render our fallback view.
  const displaySource = errored && fallbackSource ? fallbackSource : source;

  return (
    <View style={[styles.container, (style as any) && { overflow: "hidden" }]}> 
      {showLoader && loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="small" />
        </View>
      )}
      <Image
        {...rest}
        source={displaySource}
        onError={(e) => {
          setErrored(true);
          if (rest.onError) rest.onError(e.nativeEvent.error as any);
        }}
        onLoadEnd={() => setLoading(false)}
        // Avoid fade-in artifacts on some Android releases
        fadeDuration={0}
        // Prefer faster resize method to avoid partial-draw artifacts
        resizeMethod={Platform.OS === "android" ? "resize" : "auto"}
        // Ensure border rendering is solid to avoid missing seam pixels
        style={[styles.image, style]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  image: {
    // ensure solid border style to avoid hairline gaps when combined
    borderStyle: "solid",
  },
  loader: {
    ...hairline("all"),
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ImageWithFallback;
