export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/play/index',
    'pages/review/index',
    'pages/models/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFF1A8',
    navigationBarTitleText: '动感 AI 狼人杀',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#8F6A58',
    selectedColor: '#F05A3F',
    backgroundColor: '#FFF4D8',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/review/index',
        text: '历史',
        iconPath: 'assets/tabbar/review.png',
        selectedIconPath: 'assets/tabbar/review-selected.png'
      },
      {
        pagePath: 'pages/models/index',
        text: '模型',
        iconPath: 'assets/tabbar/models.png',
        selectedIconPath: 'assets/tabbar/models-selected.png'
      }
    ]
  }
})
