# Device Check

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-device-check/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-device-check/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-device-check/)

[English README](README.md)

カメラ、マイク、スピーカー、画面、キーボード、ポインター/タッチ、ゲームパッド、モーションセンサーを、1つの画面からまとめて確認できる単一HTMLのブラウザーツールです。

## 🚀 デモ

### [GitHub PagesでDevice Checkを開く](https://ttomohisa.github.io/htmlapps-device-check/)

インストールやアカウント登録は不要です。確認したいテストを選び、実際にカメラを映す、話す、音を聞く、キーを押す、画面に触れるなどして動作を確認します。

[![Device Check screenshot](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-device-check/)

## 主な機能

- **会議前のクイック診断** — カメラ → マイク → スピーカーを順番に確認できます。不要なときは非表示にでき、その状態を端末内に記憶します。通常の個別テストもそのまま利用できます。
- **カメラ・マイクを実測** — カメラの解像度、FPS、向き、マイクの入力レベル、波形、ピーク、ノイズフロア、左右チャンネル、音声設定を確認できます。
- **スピーカーを左右別に確認** — ブラウザー内で生成した中央 / 左 / 右のテスト音を再生し、実際に聞こえたかを確認できます。
- **画面を全画面で確認** — 単色、グラデーション、16段階グレー、チェッカー、1px細線、RGB階調、焼き付き確認、モーションテストを用意しています。
- **キーボード・タッチ入力をリアルタイム表示** — `key`、`code`、修飾キー、同時押し数、キーマップ、座標、圧力、ポインター種別、同時タッチ数を確認できます。
- **ゲームパッド・モーションセンサーを確認** — ボタンやスティック軸をリアルタイム表示し、対応コントローラーでは弱/強振動も試せます。端末が対応していれば向き・加速度も確認できます。
- **ブラウザーAPI対応状況を一覧表示** — WebGL、WebGPU、WebCodecs、MediaRecorder、Gamepad、各種センサーAPIなどの対応状況を確認できます。
- **PC・スマホ対応** — PCは全テストを縦に一覧表示し、スマホは下部固定の4タブ（概要 / カメラ・音声 / 入力 / 画面・端末）でページを切り替えます。日本語 / 英語UIで、第三者の実行時ライブラリは使用していません。

## すぐに使う

### Web版を使う

[デモを開く](https://ttomohisa.github.io/htmlapps-device-check/)だけで利用できます。

カメラ、マイク、全画面、モーションなどのAPIは、ブラウザーによってHTTPSと明示的な権限許可が必要です。GitHub Pages版なら多くのブラウザーで必要なSecure Contextを満たせます。

### 単一HTMLを使う

1. このリポジトリの `dist/index.html` をダウンロードします。
2. 最新のChromium系ブラウザー、Firefox、Safariなどで開きます。
3. `file://` では利用できないAPIがある場合はGitHub Pages版を利用します。

生成済みHTMLを利用するだけなら、Python、Node.js、ローカルWebサーバーは不要です。

## 使い方

### 会議前クイック診断

1. **会議前クイック診断**を開始します。
2. カメラ映像を確認して、カメラのステップを完了します。
3. マイクテストを開始して普通に話し、入力レベルや波形が反応するか確認します。
4. スピーカーのテスト音を再生し、実際に聞こえる出力を確認します。
5. 診断を完了するか、いつでも通常の個別テストへ戻れます。使わない場合は右上の非表示ボタンで隠し、端末サマリーの「会議前クイック診断を表示」から戻せます。

### 個別テスト

メイン画面には次のテストがあります。

| テスト | 確認できる内容 |
| --- | --- |
| カメラ | プレビュー、使用デバイス、解像度、FPS、向き |
| マイク | 入力レベル、波形、ピーク、ノイズフロア、左右レベル、サンプルレート、音声処理設定 |
| スピーカー | 中央 / 左 / 右のローカル生成テスト音 |
| 画面 | 単色、グラデーション、グレー階調、チェッカー、細線、RGB階調、焼き付き、モーション |
| キーボード | `key`、`code`、修飾キー、キーマップ、同時押し数 |
| ポインター / タッチ | マウス、ペン、タッチの位置、圧力、同時入力数 |
| ゲームパッド | ボタン、スティック軸、接続情報、対応端末の振動 |
| モーション | ブラウザーが公開している端末の向き・加速度 |

画面上部の端末サマリーでは、そのセッション中に確認した診断項目数を確認できます。

### 画面テストについて

画面テストは目視確認用です。全画面表示にすることで、ドット抜け、階調、縞、残像、焼き付き、動きの見え方などを確認しやすくしていますが、測色器を使った校正ではありません。

### キーボード同時押し・マルチタッチ

キーボードでは複数キーを同時に押すと、ブラウザーが同時に検出できた最大キー数を確認できます。GhostingやN-key rolloverの参考になりますが、OSやブラウザー側のキー処理にも影響されます。

Tab / Shift+Tabでテスト領域から移動できます。**キーボード結果をクリア**を押すと、キーボードの入力履歴・現在のキー・異なるキー数・同時押し記録だけを消し、「未確認」に戻します。他の結果や動作中のテストはそのままです。フォーカスはクリアボタンに残り、テスト領域へ戻ると新しく確認できます。

タッチ画面では複数の指を同時に置いてください。`navigator.maxTouchPoints` が申告する最大数と、実際にそのセッションで同時検出できた最大数を分けて表示します。

## GitHub Pagesで公開する

このリポジトリには、単一HTMLをビルドしてGitHub Pagesへ配置するワークフローが含まれています。

1. リポジトリ名を `htmlapps-device-check` としてGitHubへPushします。
2. **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` へPushするか、ActionsからPages用ワークフローを手動実行します。
4. デプロイ成功後、`https://ttomohisa.github.io/htmlapps-device-check/` で利用できます。

公開される成果物は `dist/index.html` です。

## 開発・ビルド構成

```text
.
├─ src/index.template.html        # アプリ本体の編集元
├─ assets/
│  ├─ favicon.svg                 # アプリアイコン
│  ├─ screenshot.png              # PC版スクリーンショット
│  └─ screenshot-mobile.png       # スマホ版スクリーンショット
├─ app.config.json                # アプリ情報
├─ dependencies.json              # 依存関係定義
├─ build-standalone.bat           # Windows用ビルド入口
├─ build-standalone.ps1           # 単一HTMLビルダー
├─ scripts/                       # 検証スクリプト
├─ dist/
│  ├─ index.html                  # 生成済み単一HTML
│  └─ index.self-extract.html     # gzip自己展開版
└─ .github/workflows/
   ├─ build-standalone.yml        # ビルド検証
   └─ deploy-pages.yml            # GitHub Pages公開
```

### Windowsでローカルビルド

```bat
build-standalone.bat
```

編集するのは `src/index.template.html` です。`dist/` は生成物なので直接編集しません。

ビルド時にはテンプレートの検証で使用するmanifestやサイズレポートも生成されます。

ソースを変更したら `./build-standalone.ps1` でビルドし、`dist/index.html` を `device-check.html` にコピーしてから `./scripts/check-repository.ps1` を実行します。検証にはNode.jsを使い、合成メディアのライフサイクル・キーボード結果の回帰テストと配布HTMLの一致を確認します。実機や権限は使いません。ルートの配布HTMLが古いままだと検証が失敗します。

## 実行時の挙動

カメラ・マイクの準備中は「開始」が無効になり、すぐに「停止」を使えます。デバイスを選び直すと、準備中または動作中の入力を置き換えます。停止やページ移動後に遅れて届いた入力も解放します。ブラウザー自身の権限確認が閉じるとは限りません。「確認済み」は今回の結果として停止後も残り、ヒントに停止中であることを表示します。

映像の再生やマイクの解析開始に失敗した場合はリソースを解放し、「開始」で再試行できます。Web Audioの対応をマイク権限の要求前に確認します。デバイス一覧だけ取得に失敗した場合は入力を継続し、停止と再試行の案内を表示します。

カメラとマイクは、それぞれのテストを開始したときだけアクセスを開始します。選択済みデバイスが利用できなくなった場合や要求条件を満たせなくなった場合は、`OverconstrainedError` で停止せず、ブラウザーの既定デバイスへ自動的に切り替えて再試行します。

診断処理にバックエンドは不要です。生成HTMLは `connect-src 'none'` を含むCSPを使用し、分析タグ、外部フォント、CDNスクリプト、実行時API通信はありません。端末内に保存するのは言語選択とクイック診断の表示設定だけで、診断値はそのセッション内だけで保持します。

## 制限事項

- ブラウザーAPIだけではOSドライバーの不具合や物理故障を直接断定できません。
- 権限を拒否すると、正常なカメラ・マイク・センサーでも利用不可に見える場合があります。
- 一部のAPIはHTTPSが必要で、`dist/index.html` を `file://` で開いた場合は利用できないことがあります。
- スピーカー音が物理的に聞こえたかをブラウザー側で自動判定できないため、利用者自身が確認します。
- 画面テストは目視確認用で、測色器を使う専門的なディスプレイ校正ではありません。
- ゲームパッド振動の対応状況は、ブラウザー、コントローラー、接続方法、OSによって異なります。
- モーション・向きAPIは、モバイルブラウザーによって追加の権限操作が必要な場合があります。
- キーボードのGhosting / rollover結果はOSやブラウザーのキー処理にも影響されます。
- ネットワーク速度テストは搭載していません。

## Dependencies

Device Checkは現在、**第三者の実行時ライブラリに依存していません**。診断UI、テスト音、画面パターンは標準Web APIだけで動作します。

詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) と [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) を参照してください。

## Contributing

不具合報告や機能提案はGitHub Issuesから歓迎します。開発方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

Copyright © 2026 ttomohisa

[MIT License](LICENSE) で公開しています。
