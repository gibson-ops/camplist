# Upstream issue draft — `@expo/ui`

Post at https://github.com/expo/expo/issues/new?template=bug_report.yml

**Title:**

```
[expo-ui][iOS] universal BottomSheet never wraps children in RNHostView — all React Native content is untappable and measures zero height
```

---

## Summary

On iOS, `BottomSheet` from `@expo/ui` (the universal / `@gorhom/bottom-sheet` drop-in) passes its
React Native children straight into a SwiftUI `Group` without wrapping them in `RNHostView`.

The children still **render**, which is what makes this hard to spot, but they never join React
Native's view tree. Two consequences:

1. **Nothing is tappable.** No touch handler is attached to the hosted content, so every
   `Pressable` — and therefore every RN button, row and touchable — is inert.
2. **The content measures zero height**, so `fitToContents` has nothing to size to. The sheet
   collapses to a stub at the bottom of the screen, or snaps shut as you reach for it.

Wrapping the same children in `RNHostView` fixes both.

`TextInput` keeps working throughout, which sends debugging the wrong way: iOS makes a native text
field first responder through UIKit without RN's touch pipeline, so the one control that appears
healthy is the one that never needed the broken path.

## Environment

- `@expo/ui` **57.0.10** (also reproduced on 57.0.7)
- `expo` 57.0.8, `react-native` 0.86.0
- Xcode 26.4, iOS 26.5.2, physical iPhone
- New architecture, `expo-dev-client`

## Repro

```tsx
import { BottomSheet } from '@expo/ui';
import { Pressable, Text, View } from 'react-native';

export function Repro({ visible, onClose }) {
  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} showDragIndicator>
      <View
        style={{ padding: 16, gap: 12 }}
        onStartShouldSetResponderCapture={(e) => {
          console.log('touch', e.nativeEvent.pageX, e.nativeEvent.pageY); // never logs
          return false;
        }}
      >
        <Pressable onPress={() => console.log('pressed')}>
          <Text>Tap me</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
```

**Expected:** tapping logs `touch …` then `pressed`.

**Actual:** neither logs. The capture-phase handler is the useful part — it proves no touch reaches
the RN tree at all, rather than a `Pressable` declining to fire. The sheet also fails to size to
its content.

## Cause

`src/universal/BottomSheet/index.ios.tsx`:

```tsx
<Host style={{ position: 'absolute' }} pointerEvents="none">
  <SwiftUIBottomSheet ...>
    <Group modifiers={presentationModifiers}>{children}</Group>
  </SwiftUIBottomSheet>
</Host>
```

`children` are React Native elements handed directly to `Group`. Per `RNHostView`'s own docs
("The RN View to be hosted"), that is the component which brings an RN view into a SwiftUI tree.

## Suggested fix

```diff
-        <Group modifiers={presentationModifiers}>{children}</Group>
+        <Group modifiers={presentationModifiers}>
+          <RNHostView matchContents>{children}</RNHostView>
+        </Group>
```

`matchContents` is what reports the content's height back up, so `fitToContents` works.

Two notes from working around this locally, in case they help:

- `RNHostView` exposes only a single `matchContents: Bool`, so it matches on **both** axes. The
  hosted view then shrink-wraps horizontally and the sheet narrows to its widest line — we had a
  sheet render at 390pt on one step and 287pt on the next. `HostView.swift` already has separate
  `matchContentsHorizontal` / `matchContentsVertical` fields; exposing those on `RNHostView` too
  would let a sheet match height while filling width. We work around it by giving the hosted view
  an explicit width.
- `Host` is passed `pointerEvents="none"`. That is not the cause of the dead touches — we changed
  it to `box-none` and measured no difference — but it looks like the cause and may be worth
  revisiting anyway.

## Workaround

Compose the SwiftUI primitives directly and host the content:

```tsx
<Host style={{ position: 'absolute' }} pointerEvents="box-none">
  <BottomSheet isPresented={visible} onIsPresentedChange={(p) => !p && onClose()} fitToContents>
    <Group
      modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' }), padding({ top: 16 })]}
    >
      <RNHostView matchContents>
        <View style={{ width }}>{children}</View>
      </RNHostView>
    </Group>
  </BottomSheet>
</Host>
```

Note the explicit `width` — under `matchContents` the host sizes _from_ the child, so `'100%'` is
circular and no width at all is content-driven.
