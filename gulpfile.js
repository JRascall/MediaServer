require("dotenv").config();

const yargs = require("yargs/yargs");
const gulp = require("gulp");
const fs = require("fs");
const ts = require("gulp-typescript");
const replace = require("gulp-replace");
const { exec } = require("child_process");
const tsconfig_contents = fs.readFileSync("tsconfig.json", "utf8");
const tsconfig_json = JSON.parse(tsconfig_contents);
const tsProject = ts.createProject("tsconfig.json");
const src = tsconfig_json.include || [];
const args = yargs(process.argv.slice(2)).argv;

gulp.task("compile-ts", () => {
  const stream = gulp.src(src).pipe(tsProject()).pipe(gulp.dest("dest"));

  stream.on("end", () => {
    exec("tsc-alias -p tsconfig.json");
  });

  return stream;
});

gulp.task("move-public", () => {
  return gulp.src("public/**/*").pipe(gulp.dest("dest/public"));
});

gulp.task("docker:containers:stop-all", (cb) => {
  try {
    exec(
      "FOR /f \"tokens=*\" %i IN ('docker ps -q') DO docker stop %i",
      (err, stdout, stderr) => {
        cb();
      }
    );
  } catch(e) {
    cb();
  }
});

gulp.task("docker:containers:delete-all", (cb) => {
  try {
    exec(
      "FOR /f \"tokens=*\" %i IN ('docker ps -aq') DO docker rm %i",
      (err, stdout, stderr) => {
        cb();
      }
    );
  } catch(e) {
    cb();
  }
});

gulp.task("docker:containers:run", (cb) => {
  const inlineVars = {
    FFMPEG_PATH: "/usr/bin/ffmpeg",
  };
  const combinedVars = { ...process.env, ...inlineVars };

  const envVars = {
    FFMPEG_PATH: combinedVars.FFMPEG_PATH,
    S3_ACCESS_KEY_ID: combinedVars.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: combinedVars.S3_SECRET_ACCESS_KEY,
    S3_END_POINT: combinedVars.S3_END_POINT,
  };

  const command = [
    "docker run -d",
    "-p 1935:1935",
    "-p 8000:8000",
    "-p 3000:3000",
    "--name mediaserver",
    Object.entries(envVars)
      .map(([key, value]) => `-e ${key}=${value}`)
      .join(" "),
    "mediaserver-linux-latest",
  ].join(" ");

  exec(command, (err, stdout, stderr) => {
    if (err) {
      cb(err);
    } else {
      cb();
    }
  });
});

gulp.task("docker:images:delete-all", (cb) => {
  try {
    exec(
      "FOR /F \"tokens=*\" %i IN ('docker images -q') DO docker rmi -f %i && docker image prune -f",
      (err, stdout, stderr) => {
        cb();
      }
    );
  } catch(e) {
    cb();
  }
});

gulp.task("docker:images:build", (cb) => {
  const platform = args.windows || args.win ? "win" : "linux";
  const docker_image_name = `mediaserver-${platform}-latest`;

  try {
    exec(
      `docker build -f Dockerfile.${platform} -t ${docker_image_name} .`,
      (err, stdout, stderr) => {
        if (err) {
          cb(err);
        } else {
          cb();
        }
      }
    );
  } catch(e) {
    cb();
  }
});

gulp.task(
  "docker:images:orphen",
  gulp.series(
    "docker:containers:stop-all",
    "docker:containers:delete-all",
    "docker:images:delete-all"
  )
);

gulp.task(
  "docker:build",
  gulp.series("docker:images:orphen", "docker:images:build")
);

gulp.task(
  "docker",
  gulp.series(
    "docker:containers:stop-all",
    "docker:containers:delete-all",
    "docker:containers:run"
  )
);
gulp.task("default", gulp.series("compile-ts", "move-public"));
