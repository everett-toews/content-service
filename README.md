# Content Service

A content storage and retrieval service for deconst.

[![Build Status](https://travis-ci.org/deconst/content-service.svg?branch=master)](https://travis-ci.org/deconst/content-service)
[![Docker Repository on Quay.io](https://quay.io/repository/deconst/content-service/status "Docker Repository on Quay.io")](https://quay.io/repository/deconst/content-service)

## Setup

To develop locally, you'll need to install:

 * [Docker](https://docs.docker.com/installation/#installation) to build and launch the container.
 * [docker-compose](https://docs.docker.com/compose/install/) to manage the container's configuration.

Then, you can build and run the service with:

```bash
# Customize your environment settings.
cp environment.sample.sh environment.sh
${EDITOR} environment.sh
source environment.sh

docker-compose build
docker-compose up
```

## Configuration

The content service is configured by passing environment variables to the Docker container. These are the available configuration options:

 * `STORAGE`: *(default: `"remote"`)* Specify `memory` to use entirely in-memory storage, or `remote` to use external storage services.
 * `ADMIN_APIKEY`: **(required)** An API key that can be used by administrators or other internal services to issue and revoke API keys.

### Remote services

 * `RACKSPACE_USERNAME`: **(required if STORAGE=remote)** The username for your Rackspace account.
 * `RACKSPACE_APIKEY`: **(required if STORAGE=remote)** The API key for your Rackspace account.
 * `RACKSPACE_REGION`: **(required if STORAGE=remote)** The Rackspace region for the content service to use.
 * `RACKSPACE_SERVICENET`: *(default: `"false"`)* If `"true"`, connect to Cloud Files over ServiceNet rather than the public endpoint.
 * `CONTENT_CONTAINER`: **(required if STORAGE=remote)** Container name to use for the stored metadata envelopes.
 * `ASSET_CONTAINER`: **(required if STORAGE=remote)** Container name to use for published assets.
 * `MONGODB_URL`: **(required if STORAGE=remote)** MongoDB connection string, including any required authentication information.
 * `ELASTICSEARCH_HOST`: **(required if STORAGE=remote)** Elasticsearch connection string, including any required authentication information.

### Logging

 * `CONTENT_LOG_LEVEL`: *(default: `"info"`)* Optional logging level, case-insensitive. The valid levels are `TRACE`, `DEBUG`, `VERBOSE`, `INFO`, `WARN`, and `ERROR`.
 * `CONTENT_LOG_COLOR`: *(default: `"false"`)* Logging colorization. Set to `"true"` to enable colorful logs.
 * `NODE_ENV`: If set to `"production"`, logs will be emitted as JSON objects.

Both Cloud Files containers will be created and configured on application launch if they do not already exist.

## API

### Authorization

Endpoints that require authorization *must* be accompanied by a valid API key. Set the API key in
an `Authorization` header.

```
PUT /content/https%3A%2F%2Fgithub.com%2Fsomeuser%2Fsomerepo%2Fsomeid
Authorization: deconst apikey="12345"
```

Valid API keys include:

 * The admin API key, as specified by [the service configuration.](#configuration)
 * User keys issued by the [`POST /keys`](#post-keysnamedname) endpoint.

The content service exposes the following API endpoints:

### `GET /version`

Report the service name, version, and git commit.

*Response*

```json
{
    "commit": "e2af254",
    "service": "content-service",
    "version": "1.0.0"
}
```

### `PUT /content/:id`

**(Authorization required: any user)**

Store and index content with a specific URL-encoded *content ID*.

*Request*

The request payload must be a valid Deconst metadata envelope in JSON form.

```json
{
  "title": "Optional page title",
  "body": "<h1>page content</h1> <p>as raw HTML</p>"
}
```

*Response: Successful*

An HTTP status of 200 and an empty response body will be returned when content is accepted successfully.

### `DELETE /content/:id`

**(Authorization required: any user)**

Delete content with a specific URL-encoded *content ID*.

*Response: Successful*

An HTTP status of 204 indicates that the content has been deleted successfully.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `GET /content/:id`

Access previously stored content by its URL-encoded *content ID*.

*Response: Successful*

```json
{
  "assets": {},
  "envelope": {}
}
```

`"envelope"` will be the exact JSON document provided to `PUT /content`. `"assets"` will contain a set of site-wide layout asset variables.

*Response: Unsuccessful*

An HTTP status of 404 will be returned if the content ID isn't recognized.

### `POST /asset[?named=true]`

**(Authorization required: any user)**

Fingerprint and publish one or more static assets to a CDN-enabled Cloud Files container. Return the full URLs to the published assets.

*Request*

The request payload must be a `multipart/form-data` file upload containing the assets to upload. The content type of each file must be set appropriately.

If the query parameter `named=true` is provided, each asset's CDN URI will also be persisted in the *layout asset map* with a key derived from its form name and inserted in the `assets` object of every outgoing metadata envelope.

*Response*

```json
{
  "file1.jpg": "https://assets.horse/url/for/file1-38be7d1b981f2fb6a4a0a052453f887373dc1fe8.jpg",
  "file2.css": "https://assets.horse/url/for/file2-d2da57e04b0818f7e3dd18da3b73c9b54a73cbe5.css"
}
```

### `POST /keys?named=:name`

**(Authorization required: admin only)**

Issue a newly generated API key. The provided human-friendly name will be used to log actions performed with this key.

*Response: Successful*

```json
{
  "apikey": "6aa856c50e5c8895020ef8d35..."
}
```

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid administrator API key.

### `DELETE /keys/:apikey`

**(Authorization required: admin only)**

Revoke a previously issued user API key.

*Response: Successful*

An HTTP status code of 204 indicates that the API key will no longer be valid.

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid administrator API key. A 409 is generated if an administrator attempts to revoke their own key.

### `PUT /control`

**(Authorization required: any user)**

Change the stored control repository SHA.

*Request*

The request payload must be a JSON object containing a 40-character git commit SHA.

```json
{
  "sha": "f2fa39527c7b35b9960fd39e2eb77217db3ee517"
}
```

*Response: Successful*

A status code of 204 indicates that the new SHA has been accepted.

*Response: Unsuccessful*

An HTTP status code of 401 indicates that the request did not contain a valid API key. A status code of 400 indicates that the request body did not contain an appropriately formatted JSON document.

### `GET /control`

Retrieve the most recently stored control repository SHA.

*Response: Successful*

If a control repository SHA has been stored:

```json
{
  "sha": "f2fa39527c7b35b9960fd39e2eb77217db3ee517"
}
```

If no SHA has been stored yet:

```json
{
  "sha": null
}
```

### `POST /reindex`

Asynchronously reindex all content from the primary key-value content store in the full-text search store.

*Response: Successful*

A status code of 202 indicates the reindexing has begun. Watch the container's logs to see indexing progress.
