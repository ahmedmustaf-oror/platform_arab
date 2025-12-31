const mongoose = require('mongoose');
const slugify = require('slugify');

const postSchema = new mongoose.Schema({
  // Core Information
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    minlength: [5, 'Title must be at least 5 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  content: {
    type: String,
    required: [true, 'Post content is required'],
    minlength: [10, 'Content must be at least 10 characters'],
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
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
  
  // Classification
  postType: {
    type: String,
    enum: ['summary', 'question', 'idea', 'mindmap', 'resource', 'discussion'],
    default: 'summary',
    required: true
  },
  
  subject: {
    type: String,
    enum: ['math', 'physics', 'chemistry', 'biology', 'arabic', 'english', 'history', 'geography', 'computer', 'other'],
    required: true
  },
  
  grade: {
    type: String,
    enum: ['9', '10', '11', '12', 'university', 'general'],
    default: 'general'
  },
  
  // Tags & Categories
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    maxlength: [20, 'Tag cannot exceed 20 characters']
  }],
  
  category: {
    type: String,
    enum: ['academic', 'tips', 'review', 'help', 'discussion', 'resource'],
    default: 'academic'
  },
  
  // Files & Media
  attachments: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['pdf', 'image', 'video', 'audio', 'document'],
      required: true
    },
    name: String,
    size: Number,
    thumbnail: String
  }],
  
  // Engagement Metrics
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  saves: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  views: {
    type: Number,
    default: 0
  },
  
  viewHistory: [{
    userId: mongoose.Schema.Types.ObjectId,
    viewedAt: Date
  }],
  
  shares: {
    type: Number,
    default: 0
  },
  
  // Ratings
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: val => Math.round(val * 10) / 10
    },
    count: {
      type: Number,
      default: 0
    },
    details: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  
  // Status & Moderation
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'flagged', 'deleted'],
    default: 'published'
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  isPinned: {
    type: Boolean,
    default: false
  },
  
  moderationNotes: [{
    moderatorId: mongoose.Schema.Types.ObjectId,
    note: String,
    action: String,
    createdAt: Date
  }],
  
  // SEO & Discovery
  keywords: [String],
  
  metaDescription: String,
  
  // Timestamps
  publishedAt: {
    type: Date,
    default: Date.now
  },
  
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Relations
  relatedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  
  // For questions
  isSolved: {
    type: Boolean,
    default: false
  },
  
  acceptedAnswer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
postSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

postSchema.virtual('savesCount').get(function() {
  return this.saves.length;
});

postSchema.virtual('commentsCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'post',
  count: true
});

postSchema.virtual('popularityScore').get(function() {
  const likesWeight = this.likesCount * 2;
  const savesWeight = this.savesCount * 3;
  const commentsWeight = (this.commentsCount || 0) * 1.5;
  const viewsWeight = this.views * 0.1;
  const ratingWeight = this.rating.average * 20;
  
  return likesWeight + savesWeight + commentsWeight + viewsWeight + ratingWeight;
});

postSchema.virtual('readTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Indexes for performance
postSchema.index({ slug: 1 });
postSchema.index({ author: 1 });
postSchema.index({ subject: 1, grade: 1 });
postSchema.index({ postType: 1 });
postSchema.index({ 'rating.average': -1 });
postSchema.index({ popularityScore: -1 });
postSchema.index({ publishedAt: -1 });
postSchema.index({ lastActivity: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ status: 1, isFeatured: 1 });
postSchema.index({ isPinned: -1, publishedAt: -1 });

// Pre-save middleware
postSchema.pre('save', function(next) {
  // Generate slug from title
  if (this.isModified('title')) {
    const timestamp = Date.now().toString().slice(-5);
    this.slug = slugify(`${this.title} ${timestamp}`, {
      lower: true,
      strict: true,
      locale: 'ar'
    });
  }
  
  // Generate excerpt if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200) + '...';
  }
  
  // Update last activity
  this.lastActivity = new Date();
  
  next();
});

// Post-save middleware to update user stats
postSchema.post('save', async function(doc) {
  if (doc.status === 'published') {
    await mongoose.model('User').updateOne(
      { _id: doc.author },
      { $inc: { 'stats.postsCount': 1 } }
    );
  }
});

// Methods
postSchema.methods.incrementViews = async function(userId = null) {
  this.views += 1;
  
  if (userId) {
    // Add to view history if not already viewed recently
    const recentView = this.viewHistory.find(
      view => view.userId.toString() === userId.toString() &&
      new Date() - view.viewedAt < 24 * 60 * 60 * 1000
    );
    
    if (!recentView) {
      this.viewHistory.push({
        userId,
        viewedAt: new Date()
      });
    }
  }
  
  await this.save();
};

postSchema.methods.addRating = async function(userId, ratingValue) {
  if (ratingValue < 1 || ratingValue > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  // Update rating details
  const oldRating = this.rating.details[ratingValue] || 0;
  this.rating.details[ratingValue] = oldRating + 1;
  
  // Recalculate average
  const totalRatings = Object.values(this.rating.details).reduce((a, b) => a + b, 0);
  const sumRatings = Object.entries(this.rating.details).reduce(
    (sum, [rating, count]) => sum + (parseInt(rating) * count), 0
  );
  
  this.rating.average = sumRatings / totalRatings;
  this.rating.count = totalRatings;
  
  await this.save();
};

// Static methods
postSchema.statics.getTrending = function(limit = 10, subject = null) {
  const pipeline = [
    { $match: { status: 'published' } },
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: [{ $size: '$likes' }, 2] },
            { $multiply: [{ $size: '$saves' }, 3] },
            { $multiply: ['$views', 0.1] },
            { $multiply: ['$rating.average', 20] }
          ]
        },
        recency: {
          $divide: [
            { $subtract: [new Date(), '$publishedAt'] },
            1000 * 60 * 60 * 24 // Convert to days
          ]
        }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $divide: ['$score', { $add: [1, '$recency'] }]
        }
      }
    },
    { $sort: { trendingScore: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorDetails'
      }
    },
    { $unwind: '$authorDetails' },
    {
      $project: {
        title: 1,
        slug: 1,
        excerpt: 1,
        postType: 1,
        subject: 1,
        authorName: 1,
        authorAvatar: '$authorDetails.avatar',
        likesCount: { $size: '$likes' },
        savesCount: { $size: '$saves' },
        commentsCount: 1,
        views: 1,
        rating: 1,
        publishedAt: 1,
        readTime: 1,
        tags: 1
      }
    }
  ];
  
  if (subject) {
    pipeline[0].$match.subject = subject;
  }
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Post', postSchema);
