# ReitakuCampus - 麗澤大学キャンパスツアー

このプロジェクトは、麗澤大学のキャンパスを360°パノラマビューと地図で体験できるWebサイトです。

## リポジトリのクローン方法 (How to Clone)

### 1. HTTPSを使用したクローン
```bash
git clone https://github.com/CoderK-star/ReitakuCampus.git
cd ReitakuCampus
```

### 2. SSHを使用したクローン（SSH鍵を設定済みの場合）
```bash
git clone git@github.com:CoderK-star/ReitakuCampus.git
cd ReitakuCampus
```

### 3. GitHub CLIを使用したクローン
```bash
gh repo clone CoderK-star/ReitakuCampus
cd ReitakuCampus
```

## セットアップ (Setup)

このプロジェクトは純粋なHTML/CSS/JavaScriptで構築されているため、特別なビルドツールやパッケージマネージャーは必要ありません。

### 必要なもの
- Webブラウザ（Chrome, Firefox, Safari, Edgeなど）
- ローカルWebサーバー（開発環境用）

## 実行方法 (How to Run)

### 方法1: ローカルWebサーバーを使用（推奨）

#### Pythonを使用
```bash
python -m http.server 8000
# または python3 -m http.server 8000
```

#### Node.jsのhttp-serverを使用
```bash
npx http-server -p 8000
```

#### PHPを使用
```bash
php -S localhost:8000
```

その後、ブラウザで以下にアクセス：
```
http://localhost:8000
```

### 方法2: Visual Studio Code Live Server拡張機能を使用
1. VS Codeで「Live Server」拡張機能をインストール
2. `index.html`を右クリック
3. "Open with Live Server"を選択

### 方法3: ブラウザで直接開く
`index.html`をブラウザにドラッグ＆ドロップするか、ダブルクリックで開きます。
（注意: 一部の機能が正しく動作しない可能性があります）

## プロジェクト構造

```
ReitakuCampus/
├── index.html          # メインHTMLファイル
├── page.js             # メインJavaScriptファイル（設定とロジック）
├── README.txt          # このファイル
├── image/              # 画像ファイル
│   ├── main1.jpg - main5.jpg    # ヒーロースライダー用画像
│   └── model*.png               # ギャラリー用画像（現在6枚）
└── CopyOfMap/          # 360°パノラマビューとマップ機能
    ├── index.html      # マップビューア
    ├── js/             # マップ用JavaScript
    ├── images/         # パノラマ画像
    └── icons/          # アイコン画像
```

## カスタマイズ

`page.js`の`config`オブジェクトを編集することで、サイトの内容をカスタマイズできます：

- `name`: サイト左上のロゴ名
- `hero`: トップエリアのタイトルとサブタイトル
- `concept`: コンセプト文章
- `textData`: 各施設の情報（名前、説明、パノラマ画像パス）

## 機能

- ✨ 360°パノラマビュー
- 🗺️ インタラクティブなキャンパスマップ
- 🖼️ 自動スライダー付きギャラリー
- 📱 レスポンシブデザイン（モバイル対応）
- 🖱️ ドラッグ可能な無限スクロールギャラリー

## ブラウザ対応

- Google Chrome（推奨）
- Mozilla Firefox
- Safari
- Microsoft Edge
- その他のモダンブラウザ

## ライセンス

このプロジェクトは麗澤大学のキャンパスツアー用に作成されています。

## お問い合わせ

麗澤大学
〒277-8686 千葉県柏市光ヶ丘2-1-1
https://www.reitaku-u.ac.jp/
