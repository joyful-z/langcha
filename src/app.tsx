import { useEffect } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
// 全局样式
import './app.scss';

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({ env: 'cloud1-d7gnusjl38b968039', traceUser: true });
    }
  }, []);

  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
