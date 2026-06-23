import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor={Colors.dark.background}
      indicatorColor={Colors.dark.backgroundElement}
      labelStyle={{ selected: { color: Colors.dark.text } }}>
      <NativeTabs.Trigger name="random">
        <NativeTabs.Trigger.Label>Random</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/house.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="folders">
        <NativeTabs.Trigger.Label>Folders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/folder.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
