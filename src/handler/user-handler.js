const pool = require('../config/db-config');
const { isPlantActivityExist, getPlantActivitiesCount } = require('../util/user-util');
const { getPlantCategory } = require('../util/category-util');

const getPlantActivities = async (request, h) => {
  const { username } = request.params;
  const { isPlanting, isPlanted, isFavorited } = request.query;
  let { page, size } = request.query;
  let response = '';
  let result = '';

  try {
    page = page || 1;
    size = size || 10;

    // Get posts
    if ((!isPlanting || isPlanting === 'false') && (!isPlanted || isPlanted === 'false') && (!isFavorited || isFavorited === 'false')) {
      result = await pool.query(
        'SELECT * FROM public."plant" WHERE author = $1 ORDER BY published_on DESC OFFSET $2 LIMIT $3',
        [username, (page - 1) * size, size],
      );
    }

    // Get planting plants
    if (isPlanting === 'true') {
      result = await pool.query(
        'SELECT * FROM public."planting" INNER JOIN public."plant" ON plant = "plant".id WHERE "user" = $1 ORDER BY "planting".id DESC OFFSET $2 LIMIT $3',
        [username, (page - 1) * size, size],
      );
    }

    // Get planted plants
    if (isPlanted === 'true') {
      result = await pool.query(
        'SELECT * FROM public."planted" INNER JOIN public."plant" ON plant = "plant".id WHERE "user" = $1 ORDER BY "planted".id DESC OFFSET $2 LIMIT $3',
        [username, (page - 1) * size, size],
      );
    }

    // Get favorite plants
    if (isFavorited === 'true') {
      result = await pool.query(
        'SELECT * FROM public."favorite" INNER JOIN public."plant" ON plant = "plant".id WHERE "user" = $1 ORDER BY "favorite".id DESC OFFSET $2 LIMIT $3',
        [username, (page - 1) * size, size],
      );
    }

    if (!isFavorited) {
      response = h.response({
        code: 200,
        status: 'OK',
        data: await Promise.all(result.rows.map(async (plant) => ({
          id: plant.id,
          name: plant.name,
          image: plant.image,
          category: await getPlantCategory(plant.category),
          growthEst: plant.growth_est,
          wateringFreq: plant.watering_freq,
          popularity: plant.popularity,
          isFavorited: await isPlantActivityExist(username, plant.id, false, false, true),
        }))),
      });
    } else {
      response = h.response({
        code: 200,
        status: 'OK',
        data: await Promise.all(result.rows.map(async (plant) => ({
          id: plant.id,
          name: plant.name,
          image: plant.image,
          category: await getPlantCategory(plant.category),
          growthEst: plant.growth_est,
          wateringFreq: plant.watering_freq,
          popularity: plant.popularity,
        }))),
      });
    }

    response.code(200);
  } catch (err) {
    response = h.response({
      code: 400,
      status: 'Bad Request',
      message: 'error',
    });

    response.code(400);

    console.log(err);
  }

  return response;
};

const addPlantActivity = async (request, h) => {
  const { username } = request.params;
  const { plantId } = request.payload;
  const { isPlanting, isPlanted, isFavorited } = request.query;
  let result = '';
  let response = '';
  let isAdded = false;

  try {
    if (isPlanting) {
      if (await isPlantActivityExist(username, plantId, true, false, false)) {
        response = h.response({
          code: 409,
          status: 'Conflict',
          message: 'User activity already exists',
        });

        response.code(409);
      } else {
        result = await pool.query(
          'INSERT INTO public."planting" ("user", plant) VALUES ($1, $2) RETURNING *',
          [username, plantId],
        );

        isAdded = true;
      }
    } else if (isPlanted) {
      if (await isPlantActivityExist(username, plantId, false, true, false)) {
        response = h.response({
          code: 409,
          status: 'Conflict',
          message: 'User activity already exists',
        });

        response.code(409);
      } else {
        result = await pool.query(
          'INSERT INTO public."planted" ("user", plant) VALUES ($1, $2) RETURNING *',
          [username, plantId],
        );

        await pool.query(
          'DELETE FROM public."planting" WHERE "user"=$1 AND plant=$2',
          [username, plantId],
        );

        isAdded = true;
      }
    } else if (isFavorited) {
      if (await isPlantActivityExist(username, plantId, false, false, true)) {
        response = h.response({
          code: 409,
          status: 'Conflict',
          message: 'User activity already exists',
        });

        response.code(409);
      } else {
        result = await pool.query(
          'INSERT INTO public."favorite" ("user", plant) VALUES ($1, $2) RETURNING *',
          [username, plantId],
        );

        // Update plant popularity
        const popularityRes = await pool.query(
          'SELECT popularity FROM public."plant" WHERE id=$1',
          [plantId],
        );

        const curPopularity = popularityRes.rows[0].popularity;

        await pool.query(
          'UPDATE public."plant" SET popularity=$1 WHERE id=$2',
          [curPopularity + 1, plantId],
        );

        isAdded = true;
      }
    }

    if (isAdded) {
      if (result) {
        response = h.response({
          code: 201,
          status: 'Created',
          message: 'New user activity has been added successfully',
        });

        response.code(201);
      } else {
        response = h.response({
          code: 500,
          status: 'Internal Server Error',
          message: 'New user activity cannot be added',
        });

        response.code(500);
      }
    }
  } catch (err) {
    response = h.response({
      code: 400,
      status: 'Bad Request',
      message: 'error',
    });

    response.code(400);

    console.log(err);
  }

  return response;
};

const deletePlantActivity = async (request, h) => {
  const { username, plantId } = request.params;
  const { isPlanting, isPlanted, isFavorited } = request.query;
  let result = '';
  let response = '';
  let isDeleted = false;

  try {
    if (isPlanting) {
      if (await isPlantActivityExist(username, plantId, true, false, false)) {
        result = await pool.query(
          'DELETE FROM public."planting" WHERE "user"=$1 AND plant=$2',
          [username, plantId],
        );

        isDeleted = true;
      } else {
        response = h.response({
          code: 404,
          status: 'Not found',
          message: 'User activity is not found',
        });

        response.code(409);
      }
    } else if (isPlanted) {
      if (await isPlantActivityExist(username, plantId, false, true, false)) {
        result = await pool.query(
          'DELETE FROM public."planted" WHERE "user"=$1 AND plant=$2',
          [username, plantId],
        );

        isDeleted = true;
      } else {
        response = h.response({
          code: 404,
          status: 'Not found',
          message: 'User activity not found',
        });

        response.code(409);
      }
    } else if (isFavorited) {
      if (await isPlantActivityExist(username, plantId, false, false, true)) {
        result = await pool.query(
          'DELETE FROM public."favorite" WHERE "user"=$1 AND plant=$2',
          [username, plantId],
        );

        // Update plant popularity
        const popularityRes = await pool.query(
          'SELECT popularity FROM public."plant" WHERE id=$1',
          [plantId],
        );

        const curPopularity = popularityRes.rows[0].popularity;

        if (curPopularity >= 0) {
          await pool.query(
            'UPDATE public."plant" SET popularity=$1 WHERE id=$2',
            [curPopularity - 1, plantId],
          );
        }

        isDeleted = true;
      } else {
        response = h.response({
          code: 404,
          status: 'Not found',
          message: 'User activity not found',
        });

        response.code(409);
      }
    }

    if (isDeleted) {
      if (result) {
        response = h.response({
          code: 200,
          status: 'OK',
          message: 'User activity has been deleted',
        });

        response.code(200);
      } else {
        response = h.response({
          code: 500,
          status: 'Internal Server Error',
          message: 'User activity plant cannot be deleted',
        });

        response.code(500);
      }
    }
  } catch (err) {
    response = h.response({
      code: 400,
      status: 'Bad Request',
      message: 'error',
    });

    response.code(400);

    console.log(err);
  }

  return response;
};

const getUserProfile = async (request, h) => {
  const { username } = request.params;
  let response = '';

  try {
    const result = await pool.query(
      'SELECT * FROM public."user" WHERE username = $1',
      [username],
    );

    if (result.rows[0]) {
      const profile = result.rows[0];

      response = h.response({
        ccode: 200,
        status: 'OK',
        data: {
          username: profile.username,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          planting: await getPlantActivitiesCount(username, true, false, false),
          planted: await getPlantActivitiesCount(username, false, true, false),
          uploaded: await getPlantActivitiesCount(username, false, false, true),
        },
      });

      response.code(200);
    } else {
      response = h.response({
        code: 404,
        status: 'Not Found',
        message: 'User is not found',
      });

      response.code(404);
    }
  } catch (err) {
    response = h.response({
      code: 400,
      status: 'Bad Request',
      message: 'error',
    });

    response.code(400);

    console.log(err);
  }
  return response;
};

module.exports = {
  getPlantActivities,
  addPlantActivity,
  deletePlantActivity,
  getUserProfile,
};
