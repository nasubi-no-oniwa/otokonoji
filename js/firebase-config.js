// =============================================
//  漢ノ字の接続先（Firebase：漢ノ字専用のプロジェクト）
//  ※Firebase の画面の「マイアプリ」に出る設定を、そのまま下に貼りかえてください
//  ※この値は公開しても問題ない種類のものです（守りはデータベースのルールで行います）
// =============================================
window.OK = window.JM = window.OK || window.JM || {};
OK.VER = 1;   // 版の番号（version.json と同じにする。上げると開いたままの古い画面が読みなおす）
OK.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
