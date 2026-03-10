# AI-Ready Comment Threads

source_title: "Sample Video"
source_id: "vid-123"
source_url: "https://example.com/video"
extractor: "YouTube"
generated_at_utc: "2026-03-11T00:00:00.000Z"
raw_info_json: null
comments_detected: 7
comments_returned: 7
root_threads: 4
reply_comments: 3
orphan_comments: 2
has_threading: true
has_more: false

## Notes

- Optimized for LLMs with stable keys, explicit `parent_id`, and preserved thread structure.
- If the extractor does not expose `parent`, every comment is treated as a root thread.
- `orphan_comments` means a reply arrived without its parent in the fetched payload.

## Threads

### Thread 1

- comment_id: "c1"
  parent_id: "root"
  depth: 0
  author: "Alice"
  is_pinned: true
  like_count: 12
  time_text: "2 days ago"
  reply_count: 1
  text:
    | Root comment 1
  - comment_id: "r1"
    parent_id: "c1"
    depth: 1
    author: "Bob"
    time_text: "1 day ago"
    reply_count: 1
    text:
      | Reply 1
    - comment_id: "r2"
      parent_id: "r1"
      depth: 2
      author: "Carol"
      time_text: "12 hours ago"
      reply_count: 0
      text:
        | Nested reply

### Thread 2

- comment_id: "orphan-1"
  parent_id: "root"
  depth: 0
  author: "Dana"
  time_text: "3 hours ago"
  reply_count: 0
  text:
    | Orphan reply

### Thread 3

- comment_id: "self-1"
  parent_id: "root"
  depth: 0
  author: "Eve"
  time_text: "1 hour ago"
  reply_count: 0
  text:
    | Self parent

### Thread 4

- comment_id: "c2"
  parent_id: "root"
  depth: 0
  author: "Frank"
  like_count: 1
  time_text: "4 days ago"
  reply_count: 1
  text:
    | Root comment 2
  - comment_id: "r3"
    parent_id: "c2"
    depth: 1
    author: "Grace"
    reply_count: 0
    text:
      | Reply to second root
