/**
 * @schema StoreProductImage
 * type: object
 * description: The image's details.
 * x-schemaName: StoreProductImage
 * required:
 *   - id
 *   - url
 *   - rank
 * properties:
 *   id:
 *     type: string
 *     title: id
 *     description: The image's ID.
 *   url:
 *     type: string
 *     title: url
 *     description: The image's URL.
 *   created_at:
 *     type: string
 *     format: date-time
 *     title: created_at
 *     description: The date the image was created.
 *   updated_at:
 *     type: string
 *     format: date-time
 *     title: updated_at
 *     description: The date the image was updated.
 *   deleted_at:
 *     type: string
 *     format: date-time
 *     title: deleted_at
 *     description: The date the image was deleted.
 *   metadata:
 *     type: object
 *     description: The image's metadata, can hold custom key-value pairs.
 *   rank:
 *     type: number
 *     title: rank
 *     description: The image's rank among its sibling images
 * 
*/

