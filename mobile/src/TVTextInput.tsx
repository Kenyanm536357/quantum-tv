/**
 * TV-friendly TextInput wrapper.
 *
 * On Android TV / Fire TV, a bare <TextInput /> is NOT D-pad-focusable —
 * the focus engine skips over it because TextInput on the tvOS RN fork
 * defaults to `isTVSelectable=false`. That means the user can D-pad TO
 * the input, but pressing Select does nothing and the on-screen keyboard
 * never opens.
 *
 * The fix is to wrap the input in a Pressable (which IS focusable on TV),
 * draw the focus ring on the wrapper, and on Select press explicitly call
 * inputRef.focus(). That triggers the OS soft keyboard.
 *
 * On phones it behaves exactly like a normal <TextInput />, just with a
 * tap target equal to the wrapper.
 */
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  Pressable,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Platform,
} from "react-native";
import { IS_TV } from "./responsive";
import { colors } from "./api";

export type TVTextInputProps = TextInputProps & {
  /** Outer Pressable wrapper style (where the focus ring is drawn) */
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Optional left adornment (e.g. icon) */
  left?: React.ReactNode;
  /** Optional right adornment (e.g. show-password toggle) */
  right?: React.ReactNode;
  /** When true, give this field initial TV focus on mount */
  hasTVPreferredFocus?: boolean;
};

const TVTextInput = forwardRef<TextInput, TVTextInputProps>(
  ({ wrapperStyle, left, right, hasTVPreferredFocus, style, ...inputProps }, ref) => {
    const innerRef = useRef<TextInput | null>(null);
    useImperativeHandle(ref, () => innerRef.current as TextInput);

    const focusInput = () => {
      // requestAnimationFrame avoids a race where the Pressable steals focus
      // back from the TextInput on the same Select press.
      requestAnimationFrame(() => {
        innerRef.current?.focus();
      });
    };

    return (
      <Pressable
        onPress={focusInput}
        focusable={IS_TV}
        // @ts-ignore — tvParallaxProperties / hasTVPreferredFocus are TV-only
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={({ focused }) => [
          styles.wrap,
          wrapperStyle,
          focused && styles.focusRing,
        ]}
      >
        <View style={styles.row} pointerEvents={IS_TV ? "none" : "auto"}>
          {left ? <View style={styles.left}>{left}</View> : null}
          <TextInput
            ref={innerRef}
            // On TV, the inner TextInput must NOT participate in D-pad focus;
            // the Pressable is the focus target. Phones ignore this prop.
            // @ts-ignore
            isTVSelectable={false}
            // @ts-ignore
            focusable={!IS_TV}
            editable
            style={[styles.input, style]}
            // Tapping the TextInput on a touch device (phone/tablet)
            // should still bring up the keyboard the normal way.
            {...inputProps}
          />
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      </Pressable>
    );
  }
);

TVTextInput.displayName = "TVTextInput";

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  left: { paddingLeft: 12 },
  right: { paddingRight: 6 },
  input: {
    flex: 1,
    color: "#fff",
  },
  focusRing: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(6,182,212,0.10)",
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 10 } : null),
  },
});

export default TVTextInput;
