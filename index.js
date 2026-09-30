/**
 * App entry.
 *
 * Notifee's background event handler has to be registered at the top level of
 * the entry file, before the app itself starts. Android runs it as a headless
 * JS task when a notification action is pressed while the app is not running —
 * which is what lets Pause / Resume / Log it work without opening the app.
 *
 * `import` statements are hoisted, so the router is pulled in with `require`
 * below to guarantee the handler is registered first.
 */
import notifee from '@notifee/react-native';
import { handleTimerEvent } from './lib/timerNotification';

notifee.onBackgroundEvent(handleTimerEvent);

require('expo-router/entry');
