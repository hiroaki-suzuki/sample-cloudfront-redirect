# CloudFront リダイレクト

CloudFront Functionsを使ってリダイレクトを行うサンプル。

## 初期設定

- ルートディレクトリで`npm ci`を実行する
- cdkディレクトリで`npm ci`を実行する
- terraformディレクトリで`terraform init`を実行する

## リダイレクトルール

- /
  - リダイレクトしない
- /index.html
  - リダイレクトしない
- /page1.html
  - CloudFrontのドキュメントにリダイレクトする
- それ以外
  - AWSのトップページにリダイレクトする

## CDK

- デプロイ
  - `npm run cdk:deploy` でデプロイ
- 動作確認
  - CloudFrontのURLでアクセスする
  - リダイレクトが正しく動作することを確認する
- 削除
  - オリジンS3バケット、CloudFrontログバケットを空にする
  - `npm run cdk:destroy` で削除

## CloudFormation

- デプロイ
  - `npm run cf:deploy` でデプロイ
  - オリジンS3バケットに、origin/index.htmlをアップロードする
- 動作確認
  - CloudFrontのURLでアクセスする
  - リダイレクトが正しく動作することを確認する
- 削除
  - オリジンS3バケット、CloudFrontログバケットを空にする
  - `npm run cf:destroy` で削除

## TerraForm

- デプロイ
  - `npm run terraform:apply` でデプロイ
  - オリジンS3バケットに、origin/index.htmlをアップロードする
- 動作確認
  - CloudFrontのURLでアクセスする
  - リダイレクトが正しく動作することを確認する
- 削除
  - オリジンS3バケット、CloudFrontログバケットを空にする
  - `npm run terraform:destroy` で削除

## 削除時の注意点

CloudFrontのログは、時間差でS3バケットに書き込まれるため、タイミングによっては失敗してしまうことがある  
その場合は、再度S3バケットを空にしてからコマンドを実行する