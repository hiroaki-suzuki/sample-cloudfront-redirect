import * as cdk from 'aws-cdk-lib'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import {
  CfnOriginAccessControl,
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { CfnDistribution } from 'aws-cdk-lib/aws-lightsail'
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import * as path from 'node:path'

interface CdkStackProps extends cdk.StackProps {
  readonly projectName: string
}

export class CdkStack extends cdk.Stack {
  private readonly projectName: string

  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props)

    const { projectName } = props
    this.projectName = projectName

    // オリジンバケットを作成する
    const originBucket = this.createOriginBucket()

    // CloudFrontのログを保存するS3バケットを作成
    const loggingBucket = this.createLoggingBucket()

    // リダイレクト用のLambda@Edgeを作成
    const redirectFunction = this.createRedirectLambda()

    // CloudFrontディストリビューションを作成
    const distribution = this.createCloudFrontDistribution(
      originBucket,
      loggingBucket,
      redirectFunction,
    )

    // CloudFrontからのアクセスを許可するバケットポリシーを追加
    this.addToResourcePolicy(this.account, originBucket, distribution)

    // S3バケットに静的ファイルをデプロイ
    this.deployOriginTo(originBucket)

    new CfnOutput(this, 'CloudFrontDomainName', {
      value: `https://${distribution.distributionDomainName}`,
    })
  }

  private createOriginBucket(): Bucket {
    return new Bucket(this, 'OriginBucket', {
      bucketName: `${this.projectName}-origin-bucket`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    })
  }

  private createLoggingBucket(): Bucket {
    return new Bucket(this, 'CloudFrontLogBucket', {
      bucketName: `${this.projectName}-cloudfront-log-bucket`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })
  }

  private createRedirectLambda(): Function {
    return new Function(this, 'RedirectFunction', {
      functionName: `${this.projectName}-redirect-function`,
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromFile({
        filePath: path.join(__dirname, '../../lambda/redirect.js'),
      }),
    })
  }

  private createCloudFrontDistribution(
    originBucket: Bucket,
    loggingBucket: Bucket,
    redirectFunction: Function,
  ): Distribution {
    const distribution = new Distribution(this, 'Distribution', {
      comment: `${this.projectName}-distribution`,
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: new S3Origin(originBucket, {
          originId: `${this.projectName}-s3-origin`,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
        functionAssociations: [
          {
            function: redirectFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      logBucket: loggingBucket,
      enableLogging: true,
      logIncludesCookies: true,
    })

    // オリジンアクセスコントロール (OAC)を作成
    const cfnOriginAccessControl = new CfnOriginAccessControl(this, 'FrontS3OriginAccessControl', {
      originAccessControlConfig: {
        name: `${this.projectName}-front-origin-access-control`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
        description: 'S3 Origin Access Control',
      },
    })

    const cfnDistribution = distribution.node.defaultChild as CfnDistribution
    // 自動で作られるOAIをディストリビューションの紐付けを削除
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      '',
    )
    // OACをディストリビューションの紐付け
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      cfnOriginAccessControl.attrId,
    )

    return distribution
  }

  private addToResourcePolicy(
    account: string,
    originBucket: Bucket,
    cloudFrontDistribution: Distribution,
  ): void {
    originBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal',
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [originBucket.bucketArn + '/*'],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${account}:distribution/${cloudFrontDistribution.distributionId}`,
          },
        },
      }),
    )
  }

  private deployOriginTo(originBucket: Bucket) {
    new BucketDeployment(this, 'DeployOrigin', {
      sources: [Source.asset('../origin')],
      destinationBucket: originBucket,
    })
  }
}
