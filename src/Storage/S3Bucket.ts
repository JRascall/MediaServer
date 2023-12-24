import { AWSError, S3 } from "aws-sdk";
import AWS from "aws-sdk";
import {
  AbortMultipartUploadRequest,
  ListBucketsOutput,
} from "aws-sdk/clients/s3";
import { PromiseResult } from "aws-sdk/lib/request";

const Logger = require("../node_core_logger");

export class S3Bucket {
  private _s3: S3;

  constructor(
    private bucket_name: string,
    access_key_id: string,
    secret_access_key: string,
    endpoint: string,
    version: string = "v4"
  ) {
    this._s3 = new AWS.S3({
      accessKeyId: access_key_id,
      secretAccessKey: secret_access_key,
      endpoint,
      s3ForcePathStyle: true,
      signatureVersion: version,
    });

    this.print(`instance running - ${endpoint}`);
  }

  private async listAllBuckets(): Promise<
    PromiseResult<ListBucketsOutput, AWSError>
  > {
    return await this._s3.listBuckets().promise();
  }

  public async upload(
    key: string,
    content: unknown,
    content_type?: string
  ): Promise<void> {
    return new Promise(resolve => {
      let params = {
        Bucket: this.bucket_name,
        Key: key,
        Body: content,
      } as S3.PutObjectRequest;
  
      if (content_type) {
        params.ContentType = content_type;
      }

      this._s3.upload(params, (err: Error, data: any) => {
        if (err) {
          this.printError(`error uploading - ${key}`);
          resolve();
        }
        this.print(`uploaded - ${key}`);
        resolve();
      });
    });
  }

  public async configureLifcycle(): Promise<void> {
    await this._s3
      .putBucketLifecycleConfiguration({
        Bucket: this.bucket_name,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "Delete Abandoned Streams",
              Status: "Enabled",
              Filter: {
                Prefix: "",
              },
              Expiration: {
                Days: 0.1,
              },
            },
          ],
        },
      })
      .promise();
  }

  public async abortUploads() {
    const multipartUploads = await this._s3
      .listMultipartUploads({ Bucket: this.bucket_name })
      .promise();

    if (
      multipartUploads == undefined ||
      multipartUploads?.Uploads == undefined ||
      multipartUploads?.Uploads.length <= 0
    )
      return;

    this.print("attempting to abort abandoned uploads");

    for (const upload of multipartUploads.Uploads) {
      const params: AbortMultipartUploadRequest = {
        Bucket: this.bucket_name,
        Key: upload.Key!,
        UploadId: upload.UploadId!,
      };
      await this._s3.abortMultipartUpload(params).promise();
    }

    this.print(`aborted uploads`);
  }

  public async empty() {
    const params = { Bucket: this.bucket_name };
    const listedObjects = await this._s3.listObjectsV2(params).promise();

    if (
      listedObjects == undefined ||
      listedObjects.Contents == undefined ||
      listedObjects.Contents?.length <= 0
    )
      return;

    this.print("attempting to delete all objects");
    const deleteParams = {
      Bucket: this.bucket_name,
      Delete: { Objects: [] },
    };

    listedObjects.Contents.forEach(({ Key }) => {
      //@ts-ignore;
      deleteParams.Delete.Objects.push({ Key });
    });

    await this._s3.deleteObjects(deleteParams).promise();
    this.print(`emptied`);
  }

  private print(message: string): void {
    Logger.log(`[S3 Bucket ${this.bucket_name}] ${message}`);
  }

  private printError(message: string): void {
    Logger.error(`[S3 Bucket ${this.bucket_name}] ${message}`);
  }
}
