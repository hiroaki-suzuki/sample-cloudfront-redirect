terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.37.0"
    }
  }
}

provider "aws" {
  region     = "ap-northeast-1"
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

locals {
  app_name = "sample-cloudfront-redirect-terra"
}

################################################################################
# CloudFrontのオリジンS3バケット
################################################################################

# オリジンS3バケットの作成
resource "aws_s3_bucket" "origin" {
  bucket = "${local.app_name}-origin-bucket"
}

# オリジンS3バケットのバケットバージョニングの作成
resource "aws_s3_bucket_versioning" "origin" {
  bucket = aws_s3_bucket.origin.id
  versioning_configuration {
    status = "Enabled"
  }
}

# オリジンS3バケットのバケットポリシーの作成
resource "aws_s3_bucket_policy" "origin" {
  bucket = aws_s3_bucket.origin.id
  policy = data.aws_iam_policy_document.origin.json
}

# オリジンS3バケットのバケットポリシーのポリシーの作成
data "aws_iam_policy_document" "origin" {
  statement {
    sid    = "AllowCloudFrontServicePrincipal"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = [
        "cloudfront.amazonaws.com"
      ]
    }
    actions = [
      "s3:GetObject",
    ]
    resources = [
      "${aws_s3_bucket.origin.arn}/*",
    ]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [
        aws_cloudfront_distribution.app.arn,
      ]
    }
  }
}

################################################################################
# CloudFrontログ用のS3バケット
################################################################################

# CloudFrontログ用のS3バケットの作成
resource "aws_s3_bucket" "cloudfront_log" {
  bucket = "${local.app_name}-cloudfront-log-bucket"
}

# CloudFrontログ用のS3バケットのバケットバージョニングの作成
resource "aws_s3_bucket_versioning" "cloudfront_log" {
  bucket = aws_s3_bucket.cloudfront_log.id
  versioning_configuration {
    status = "Enabled"
  }
}

# CloudFrontログ用のS3バケットのオブジェクト所有者を設定
resource "aws_s3_bucket_ownership_controls" "cloudfront_log" {
  bucket = aws_s3_bucket.cloudfront_log.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

################################################################################
# CloudFront
################################################################################

# CloudFront Functionsの作成
resource "aws_cloudfront_function" "redirect" {
  name    = "${local.app_name}-redirect-function"
  comment = "${local.app_name}-redirect-function"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("../lambda/redirect.js")
}

# CloudFront OACの作成
resource "aws_cloudfront_origin_access_control" "s3_origin" {
  name                              = "${local.app_name}-s3-origin-access-control"
  description                       = "S3 Origin Access Control"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFrontの作成
resource "aws_cloudfront_distribution" "app" {
  comment             = "${local.app_name}-distribution"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_200"
  default_root_object = "index.html"

  origin {
    origin_id                = "${local.app_name}-s3-origin"
    domain_name              = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_origin.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    compress               = true
    target_origin_id       = "${local.app_name}-s3-origin"
    viewer_protocol_policy = "allow-all"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.redirect.arn
    }
  }

  logging_config {
    bucket          = aws_s3_bucket.cloudfront_log.bucket_regional_domain_name
    include_cookies = true
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# ================================================================================
# Outputs
# ================================================================================

# CloudFrontのURL
output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}