# Iceland Trip Photo Map

アイスランド旅行（2026年7月）の写真とルートを地図上にまとめたフォトマップです。

- 写真の撮影地点を地図にピン表示（近接する写真はクラスタリング）
- ピンや一覧をタップすると写真を拡大表示
- 日付ごとに色分けした移動ルート（Googleタイムラインの実データ）

## 技術メモ

- 静的サイト（HTML / CSS / JavaScript）。ビルド不要
- 地図ライブラリ: [Leaflet](https://leafletjs.com/) / タイル: CARTO Voyager（OpenStreetMap）
- 写真の位置は、各写真の撮影時刻とGoogleタイムラインのGPS軌跡を突き合わせて自動推定

## ローカルでの表示

`file://` で直接開くと地図が正しく動かないため、簡易サーバー経由で開いてください。

```bash
python3 -m http.server 8000
```

その後ブラウザで `http://localhost:8000` を開きます。
