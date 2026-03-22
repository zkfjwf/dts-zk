# Data Design

This doc contains all the data design information of this project.

## ID of users and travel spaces

We use [ULID](https://ulid.page/) to identify users and spaces:

- 128-bit
- suited for distributed systems and lexicographically sortable
- encoded as a **26** char string
- libraries:
  - [npm ulid](https://www.npmjs.com/package/ulid)
  - [go ulid](https://github.com/oklog/ulid)

## Local-First Data

In the frontend, we use `watermelonDB`, which offers local-first capacity. The backend provides `GET /sync` and `POST /sync` APIs to achieve "Pull/Push" for frontend.

| 表名 (Table)          | 字段名称    | 数据类型 | 说明                      |
| --------------------- | ----------- | -------- | ------------------------- |
| **users** (用户)      | id          | String   | 唯一标识 (ULID)           |
|                       | nickname    | String   | 用户昵称                  |
| **spaces** (旅行空间) | id          | String   | 空间唯一标识(ULID)        |
|                       | name        | String   | 空间名称                  |
| **space_members**     | id          | String   | 关联关系ID                |
|                       | space_id    | String   | 外键，关联 spaces         |
|                       | user_id     | String   | 外键，关联 users          |
| **photos** (照片)     | id          | String   | 照片ID                    |
|                       | space_id    | String   | 所属空间ID                |
|                       | uploader_id | String   | 上传者ID                  |
|                       | local_uri   | String   | 离线时的本地文件路径      |
|                       | remote_url  | String   | 上传到云端后的对象存储URL |
|                       | created_at  | Number   | 拍摄时间戳                |
| **expenses** (开销)   | id          | String   | 账单ID                    |
|                       | space_id    | String   | 所属空间                  |
|                       | payer_id    | String   | 付款人 (user_id)          |
|                       | amount      | Decimal  | 金额                      |
|                       | description | String   | 消费描述 (如: 晚餐)       |

## Real-time Data

- location：
  - latitude(纬度)：Float
  - longitude(经度)：Float
- battery: Int (0-100)
- updated_at(最后一次更新的时间戳): Number
