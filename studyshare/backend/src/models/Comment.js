const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Core Information
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    minlength: [1, 'Comment must be at least 1 character'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  
  // Author Information
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  authorName: {
    type: String,
    required: true
  },
  
  authorAvatar: String,
  
  isAnonymous: {
    type: Boolean,
    default: false
  },
  
  // Parent References
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  // Depth for nested comments
  depth: {
    type: Number,
    default: 0,
    max: 5
  },
  
  // Engagement
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'deleted', 'flagged', 'hidden'],
    default: 'active'
  },
  
  // For answer acceptance (if comment answers a question)
  isAcceptedAnswer: {
    type: Boolean,
    default: false
  },
  
  // Moderation
  flaggedBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    reason: String,
    flaggedAt: Date
  }],
  
  // Metadata
  edited: {
    type: Boolean,
    default: false
  },
  
  editHistory: [{
    content: String,
    editedAt: Date,
    reason: String
  }],
  
  // For rich content
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  attachments: [{
    url: String,
    type: String,
    name: String
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
commentSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  options: { sort: { createdAt: 1 } }
});

commentSchema.virtual('repliesCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true
});

// Indexes
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ depth: 1 });
commentSchema.index({ 'likes': 1 });
commentSchema.index({ isAcceptedAnswer: 1 });
commentSchema.index({ status: 1 });

// Pre-save middleware
commentSchema.pre('save', function(next) {
  // Calculate depth if parent comment exists
  if (this.parentComment) {
    this.depth = 1; // Will be updated in post-save
  }
  
  // Track edit history
  if (this.isModified('content') && !this.isNew) {
    this.edited = true;
    this.editHistory.push({
      content: this._previousContent || this.content,
      editedAt: new Date(),
      reason: 'User edit'
    });
  }
  
  next();
});

// Post-save middleware
commentSchema.post('save', async function(doc) {
  // Update parent post's last activity
  await mongoose.model('Post').updateOne(
    { _id: doc.post },
    { lastActivity: new Date() }
  );
  
  // Update user stats
  if (doc.status === 'active') {
    await mongoose.model('User').updateOne(
      { _id: doc.author },
      { $inc: { 'stats.commentsCount': 1 } }
    );
  }
  
  // Update
