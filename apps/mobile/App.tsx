import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { APP_SERVER_BASE_URL as APP_URL } from './src/config';

export default function App() {
  const webViewRef = useRef<WebView<{}>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Handle hardware back button on Android
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3730A3" />

      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না</Text>
          <Text style={styles.errorSubtitle}>
            ইন্টারনেট সংযোগ পরীক্ষা করুন। সার্ভার চালু হতে কিছুটা সময় লাগতে পারে, তারপর আবার চেষ্টা করুন।
          </Text>
          <Text style={styles.errorUrl}>{APP_URL}</Text>

          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>পুনরায় চেষ্টা করুন (Retry)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webContainer}>
          <WebView<{}>
            ref={webViewRef}
            source={{
              uri: APP_URL,
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (!/^https?:\/\//i.test(request.url)) return true;
              try {
                if (new URL(request.url).origin === new URL(APP_URL).origin) return true;
              } catch { return false; }
              Linking.openURL(request.url).catch(() => {});
              return false;
            }}
            onOpenWindow={(event) => {
              const url = event.nativeEvent.targetUrl;
              if (/^https?:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
            }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            setSupportMultipleWindows={false}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22D3EE" />
                <Text style={styles.loadingText}>নগরবন্ধু এআই লোড হচ্ছে...</Text>
              </View>
            )}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => setHasError(true)}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (nativeEvent.statusCode >= 500) {
                setHasError(true);
              }
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#22D3EE',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111827',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  errorUrl: {
    fontSize: 12,
    color: '#22D3EE',
    backgroundColor: '#172235',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#0B0F19',
    fontSize: 15,
    fontWeight: '600',
  },
});
