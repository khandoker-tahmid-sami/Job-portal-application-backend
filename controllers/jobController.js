const { Job, Company, Application } = require('../models');
// const { Op, Sequelize } = require('sequelize');

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Company)
const createJob = async (req, res) => {
    try {
        const { title, type, workMode, location, salaryMin, salaryMax, salaryPeriod, description, requirements, benefits, skills, deadline, vacancies, category, experienceLevel } = req.body;

        // Generate slug
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        let slugExists = await Job.findOne({ slug });
        let counter = 1;
        while (slugExists) {
            const newSlug = `${slug}-${counter}`;
            slugExists = await Job.findOne({  slug: newSlug });
            if (!slugExists) {
                slug = newSlug;
            } else {
                counter++;
            }
        }

        const job = await Job.create({
            companyId: req.company._id,
            title,
            slug,
            type,
            workMode,
            location,
            salaryMin,
            salaryMax,
            salaryPeriod,
            description,
            requirements,
            benefits,
            deadline,
            skills,
            vacancies,
            category,
            experienceLevel
        });

        res.status(201).json({ success: true, data: job });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all jobs with filters, search, and pagination
// @route   GET /api/jobs
// @access  Public
const getJobs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, type, experienceLevel, skills, minSalary, maxSalary, sort } = req.query;
        const offset = (page - 1) * limit;

        let query = { status: 'Active' };

        // 1. Search (Title and Skills) - Case Insensitive
         if (search) {
            const regex = new RegExp(search, 'i');
            query.$or = [
                { title: regex },
                { skills: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }
        // if (search) {
        //     const searchTerm = `%${search.toLowerCase()}%`;
        //     where[Op.or] = [
        //         { title: { [Op.like]: searchTerm } },
        //         // Cast JSON skills to TEXT for LIKE search
        //         Sequelize.where(
        //             Sequelize.cast(Sequelize.col('Job.skills'), 'TEXT'),
        //             { [Op.like]: searchTerm }
        //         )
        //     ];
        // }

        // Lists for Case-Insensitive Mapping
        const allowedTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
        const allowedExperienceLevels = ['Entry', 'Mid', 'Senior', 'Expert', 'Lead'];

        const mapToEnum = (inputStr, allowedList) => {
            if (!inputStr) return null;
            const values = inputStr.split(',').map(v => v.trim().toLowerCase());
            return values.map(v => allowedList.find(a => a.toLowerCase() === v) || v).filter(Boolean);
        };

        // 2. Filters

        // Type (Multi-value, Case-insensitive)
        if (type) {
            const mappedTypes = mapToEnum(type, allowedTypes);
            if (mappedTypes.length > 0) {
                query.type = { $in: mappedTypes }
            }
        }

        // Experience Level (Multi-value, Case-insensitive)
        if (experienceLevel) {
            const mappedLevels = mapToEnum(experienceLevel, allowedExperienceLevels);
            if (mappedLevels.length > 0) {
                query.experienceLevel = { $in: mappedLevels }
            }
        }

        // Skills (Multi-value - "Any" match)
        if (skills) {
            const skillList = skills.split(',').map(s => s.trim());
            // Since skills is JSON, we use LIKE for text matching on the casted JSON string
            // const skillConditions = skillList.map(s =>
            //     Sequelize.where(
            //         Sequelize.cast(Sequelize.col('Job.skills'), 'TEXT'),
            //         { [Op.like]: `%${s}%` }
            //     )
            // );

            query.skills = { $elemMatch: { $in: skillList.map(s => new RegExp(s, 'i')) } };

            // Add to AND conditions (Job must match existing 'where' AND (skill1 OR skill2 ...))
            // where[Op.and] = where[Op.and] || [];
            // where[Op.and].push({ [Op.or]: skillConditions });
        }

        // Salary Range
        if (minSalary) {
             query.salaryMin = { $gte: parseInt(minSalary) }
        }
        if (maxSalary) {
            // Job's max salary should be ideally higher than requested max?
            // Usually "maxSalary" filter means "I want jobs paying UP TO X".
            // So job.salaryMin/Max should be <= filter.maxSalary?
            // "Salary Range should be between salaryMin and salaryMax"
            // If user sends minSalary=50k, maxSalary=100k, they want jobs inside 50-100k.
            // Job (60-80) -> Yes. Job (40-60) -> Overlaps.
            // Simple logic: Job.salaryMin >= Filter.minSalary AND Job.salaryMax <= Filter.maxSalary
            // OR: Job.salaryMax >= Filter.minSalary (at least touches min).

            // Standard interpret: Show jobs where the pay fits the range.
            // Let's implement: salaryMax <= userMaxSalary (Fit within budget)
            // Or usually: salaryMin <= userMaxSalary (At least starts below my max limit)

            // Let's stick to simple "Within Range" logic if usually requested:
            // Job.salaryMin >= User.minSalary
            // Job.salaryMax <= User.maxSalary (If strictly inside)

            // User Spec: "Salary Range should be between salaryMin and salaryMax"
            // I will assume strict containment for now, or lower bound.
            query.salaryMax = { $lte: parseInt(maxSalary) };
        }

        // 3. Sorting
        // let order = [['createdAt', 'DESC']]; // Recent (Default)
        let sortOption = { createdAt: -1 };

        /*if (sort) {
            const sortLower = sort.toLowerCase();
            if (sortLower === 'salary_high') {
                order = [['salaryMax', 'DESC']]; // High to Low
            } else if (sortLower === 'salary_low') {
                order = [['salaryMin', 'ASC']]; // Low to High
            }
            // 'recent' is default fall-through
        }*/

         if (sort) {
            const sortLower = sort.toLowerCase();
            if (sortLower === 'salary_high') sortOption = { salaryMax: -1 };
            else if (sortLower === 'salary_low') sortOption = { salaryMin: 1 };
        }

        // console.log(where)
       /*const { count, rows } = await Job.findAndCountAll({
            where,
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['id', 'name', 'logoUrl', 'location']
                },
                {
                    model: Application,
                    as: 'applications',
                    attributes: ['id']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order,
            distinct: true // Important for correct count with includes
        });*/

        const count = await Job.countDocuments(query);
        const jobs = await Job.find(query)
            .populate('companyId', 'name logoUrl location')
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .sort(sortOption);

        const jobIds = jobs.map(j => j._id);
        const appCounts = await Application.aggregate([
            { $match: { jobId: { $in: jobIds } } },
            { $group: { _id: '$jobId', count: { $sum: 1 } } }
        ]);
        const countMap = {};
        appCounts.forEach(a => { countMap[a._id.toString()] = a.count; });

        

        // Add applicants count to each job
        /*const jobData = rows.map(job => {
            const jobJSON = job.toJSON();
            jobJSON.applicants = job.applications ? job.applications.length : 0;
            delete jobJSON.applications; // Clean up response
            return jobJSON;
        });*/

        const jobData = jobs.map(job => {
            const j = job.toObject();
            j.company = j.companyId;
            delete j.companyId;
            j.applicants = countMap[job._id.toString()] || 0;
            return j;
        });

        res.status(200).json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            data: jobData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get single job by Slug
// @route   GET /api/jobs/:slug
// @access  Public
const getJobBySlug = async (req, res) => {
    /*try {
        const job = await Job.findOne({
            where: { slug: req.params.slug },
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: { exclude: ['password'] }
                },
                {
                    model: Application,
                    as: 'applications',
                    attributes: ['id']
                }
            ]
        });

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const jobJSON = job.toJSON();
        jobJSON.applicants = job.applications ? job.applications.length : 0;
        delete jobJSON.applications;

        res.status(200).json({ success: true, data: jobJSON });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }*/

    try {
        const job = await Job.findOne({ slug: req.params.slug }).populate('companyId', '-password');
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        const applicantCount = await Application.countDocuments({ jobId: job._id });
        const jobObj = job.toObject();
        jobObj.company = jobObj.companyId;
        delete jobObj.companyId;
        jobObj.applicants = applicantCount;

        res.status(200).json({ success: true, data: jobObj });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update a job
// @route   PUT /api/jobs/:id
// @access  Private (Company)
const updateJob = async (req, res) => {
    /*try {
        let job = await Job.findByPk(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Check ownership
        if (job.companyId !== req.company.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
        }

        job = await job.update(req.body);

        res.status(200).json({ success: true, data: job });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }*/

    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        if (job.companyId.toString() !== req.company._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
        }

        const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
// @access  Private (Company)
const deleteJob = async (req, res) => {
    /*try {
        const job = await Job.findByPk(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Check ownership
        if (job.companyId !== req.company.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
        }

        await job.destroy();

        res.status(200).json({ success: true, message: 'Job removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }*/

    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        if (job.companyId.toString() !== req.company._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
        }

        await job.deleteOne();
        res.status(200).json({ success: true, message: 'Job removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get recommended jobs based on user profile
// @route   GET /api/jobs/recommendations
// @access  Private (User)
const getRecommendedJobs = async (req, res) => {
    /*try {
        const { skills, experienceLevel } = req.user;

        // If no skills or experience level, return allowed generic jobs or empty
        if ((!skills || skills.length === 0) && !experienceLevel) {
            return res.status(200).json({ success: true, data: [] });
        }

        let where = { status: 'Active' };
        let conditions = [];

        // Match skills (Overlap)
        // Since skills are JSON/Array, exact match is tricky in SQLite without extensive query.
        // We will simple fetch active jobs and filter/sort in JS for better recommendation logic.
        // Or using OR condition for Op.like if possible.
        // For simplicity and effectiveness in this setup:
        // We fetch all active jobs (or a subset) and score them.

        const jobs = await Job.findAll({
            where: { status: 'Active' },
            include: [{ model: Company, as: 'company', attributes: ['name', 'logoUrl', 'location'] }]
        });

        const scoredJobs = jobs.map(job => {
            let score = 0;
            const jobSkills = job.skills || [];

            // Score by skills match
            if (skills && skills.length > 0) {
                const matchCount = skills.filter(skill =>
                    jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(js.toLowerCase()))
                ).length;
                score += matchCount * 2;
            }

            // Score by experience level
            if (experienceLevel && job.experienceLevel === experienceLevel) {
                score += 5;
            }

            return { job, score };
        });

        // Filter out zero scores and sort by score desc
        const recommendations = scoredJobs
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.job); // Return only the job objects

        res.status(200).json({ success: true, data: recommendations });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }*/

    try {
        const { skills, experienceLevel } = req.user;

        if ((!skills || skills.length === 0) && !experienceLevel) {
            return res.status(200).json({ success: true, data: [] });
        }

        const jobs = await Job.find({ status: 'Active' })
            .populate('companyId', 'name logoUrl location');

        const scoredJobs = jobs.map(job => {
            let score = 0;
            const jobSkills = job.skills || [];

            if (skills && skills.length > 0) {
                const matchCount = skills.filter(skill =>
                    jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(js.toLowerCase()))
                ).length;
                score += matchCount * 2;
            }

            if (experienceLevel && job.experienceLevel === experienceLevel) score += 5;
            return { job, score };
        });

        const recommendations = scoredJobs
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.job);

        res.status(200).json({ success: true, data: recommendations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get similar jobs based on current job category and skills
// @route   GET /api/jobs/:id/similar
// @access  Public
const getSimilarJobs = async (req, res) => {
    /*try {
        const jobId = req.params.id;
        const currentJob = await Job.findByPk(jobId);

        if (!currentJob) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const { category, skills, id } = currentJob;

        let where = {
            status: 'Active',
            id: { [Op.ne]: id } // Exclude current job
        };

        let orConditions = [];

        // Condition 1: Same Category
        if (category) {
            orConditions.push({ category });
        }

        // Condition 2: Overlapping Skills
        if (skills && skills.length > 0) {
           // Since skills are JSON, search using LIKE
           const skillConditions = skills.map(s => ({
               skills: { [Op.like]: `%${s}%` }
           }));
           orConditions.push(...skillConditions);
        }

        if (orConditions.length > 0) {
            where[Op.or] = orConditions;
        }

        const jobs = await Job.findAll({
            where,
            include: [{ model: Company, as: 'company', attributes: ['name', 'logoUrl', 'location'] }],
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({ success: true, count: jobs.length, data: jobs });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }*/

    try {
        const currentJob = await Job.findById(req.params.id);
        if (!currentJob) return res.status(404).json({ success: false, message: 'Job not found' });

        const { category, skills, _id } = currentJob;
        let orConditions = [];

        if (category) orConditions.push({ category });
        if (skills && skills.length > 0) {
            orConditions.push({ skills: { $elemMatch: { $in: skills.map(s => new RegExp(s, 'i')) } } });
        }

        let query = { status: 'Active', _id: { $ne: _id } };
        if (orConditions.length > 0) query.$or = orConditions;

        const jobs = await Job.find(query)
            .populate('companyId', 'name logoUrl location')
            .limit(5)
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: jobs.length, data: jobs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    createJob,
    getJobs,
    getJobBySlug,
    updateJob,
    deleteJob,
    getRecommendedJobs,
    getSimilarJobs
};
