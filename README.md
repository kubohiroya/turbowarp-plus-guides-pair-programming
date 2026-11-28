# プラとモコのペアプログラミング教室

Scratchユーザーが小さな修正を二人で進めるためのガイドです。プラとモコが「星あつめ」を題材に、役割を交代しながら一つの作業を進めます。作者は Hiroya Kubo です。

- [6単元の解説と練習](docs/index.html)
- [紙芝居のSB3](docs/work/pair-programming-4.0.sb3)
- [二人で使う練習シート](docs/examples/pair-workbook.md)
- [セリフ・クイズの編集元](story/lesson.ts)

文書は Node.js 24以上で `npm run preview` を実行し、http://127.0.0.1:8799/ から読めます。SB3はTurboWarp Plus Editorで開きます。実行画面を引出しに表示し、緑の旗を押すと単元メニューが出ます。

文章を読む場面ではプラとモコが隠れます。▼が点滅したらステージをクリックすると先へ進みます。Spaceでも進めます。

## 再生成

```sh
npm ci --ignore-scripts
npm run prepare:app
npm run build
```

公式App 4.0.21のベースとbuilderを使います。台本から素材SVG、`story/pair-programming.k4.yml`、配布用SB3、生成記録を再生成します。GuideはEditorの組み込み機能を使います。

権利と素材の由来は [NOTICE.md](NOTICE.md)、公開Editorでの検証は [読み進め方の検証](verification/reader-pacing.json) にあります。
