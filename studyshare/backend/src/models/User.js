const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Identification
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: 'Please provide a valid email'
    }
  },
  
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Profile
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    minlength: [2, 'Display name must be at least 2 characters'],
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  
  avatar: {
    type: String,
    default: function() {
      // Generate random avatar color
      const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.displayName)}&background=${color}&color=fff&bold=true`;
    }
  },
  
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  
  // Anonymous system
  isAnonymous: {
    type: Boolean,
    default: false
  },
  
  anonymousId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Points & Badges
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  
  badges: [{
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    },
    category: {
      type: String,
      enum: ['contribution', 'achievement', 'special', 'level']
    }
  }],
  
  // Preferences
  subjects: [{
    type: String,
    enum: ['math', 'physics', 'chemistry', 'biology', 'arabic', 'english', 'history', 'geography', 'computer', 'other']
  }],
  
  grade: {
    type: String,
    enum: ['9', '10', '11', '12', 'university', 'graduate', 'teacher', 'other']
  },
  
  // Privacy settings
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'friends'],
      default: 'public'
    },
    showEmail: {
      type: Boolean,
      default: false
    },
    showActivity: {
      type: Boolean,
      default: true
    }
  },
  
  // Account status
  role: {
    type: String,
    enum: ['student', 'teacher', 'moderator', 'admin'],
    default: 'student'
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Statistics
  stats: {
    postsCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    savesReceived: { type: Number, default: 0 },
    helpfullnessScore: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 }
  },
  
  // Timestamps
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  lastLogin: Date,
  
  // Reset password
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Email verification
  emailVerificationToken: String,
  emailVerificationExpire: Date
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total contributions
userSchema.virtual('totalContributions').get(function() {
  return this.stats.postsCount + this.stats.commentsCount;
});

// Virtual for rank
userSchema.virtual('rank').get(function() {
  if (this.points >= 10000) return 'legend';
  if (this.points >= 5000) return 'master';
  if (this.points >= 2000) return 'expert';
  if (this.points >= 1000) return 'advanced';
  if (this.points >= 500) return 'intermediate';
  if (this.points >= 100) return 'beginner';
  return 'newbie';
});

// Indexes for performance
userSchema.index({ points: -1 });
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'stats.postsCount': -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActive: -1 });

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Generate anonymous ID if needed
  if (this.isAnonymous && !this.anonymousId) {
    this.anonymousId = `anon_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.displayName = this.generateAnonymousName();
  }
  
  // Hash password if modified
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  // Update last active
  this.lastActive = new Date();
  
  next();
});

// Methods
userSchema.methods.generateAnonymousName = function() {
  const adjectives = ['سريع', 'مبدع', 'ذكي', 'مثابر', 'فضولي', 'منظم', 'دقيق', 'خلاق'];
  const nouns = ['طالب', 'متعلم', 'باحث', 'قارئ', 'كاتب', 'ملخص', 'عقل', 'مفكر'];
  const numbers = Math.floor(100 + Math.random() * 900);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}_${noun}_${numbers}`;
};

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getSignedJwtToken = function() {
  return require('jsonwebtoken').sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

userSchema.methods.generateResetToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

userSchema.methods.generateVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Static methods
userSchema.statics.getTopContributors = function(limit = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        displayName: 1,
        avatar: 1,
        points: 1,
        badges: 1,
        stats: 1,
        totalContributions: { $add: ['$stats.postsCount', '$stats.commentsCount'] }
      }
    },
    { $sort: { points: -1 } },
    { $limit: limit }
  ]);
};

module.exports = mongoose.model('User', userSchema);
