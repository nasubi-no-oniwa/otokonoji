// =============================================
//  漢ノ字の接続先（Firebase：漢ノ字専用のプロジェクト）
//  ※この値は公開しても問題ない種類のものです（守りはデータベースのルールで行います）
// =============================================
window.OK = window.JM = window.OK || window.JM || {};
OK.VER = 4;   // 版の番号（version.json と同じにする。上げると開いたままの古い画面が読みなおす）
OK.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAcJgJLVbuvx85_qEGJe1WhwsOelidxeYk",
  authDomain: "otokonoji.firebaseapp.com",
  databaseURL: "https://otokonoji-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "otokonoji",
  storageBucket: "otokonoji.firebasestorage.app",
  messagingSenderId: "724063521539",
  appId: "1:724063521539:web:0b1841cc7881e892b8f736"
};
