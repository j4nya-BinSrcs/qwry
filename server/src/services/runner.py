import asyncio
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


@dataclass
class Task:
    id: str
    command: str
    status: str  # "running" | "completed" | "failed"
    started_at: datetime
    finished_at: datetime | None = None
    return_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    error: str | None = None


class TaskManager:
    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def all_tasks(self) -> list[Task]:
        return list(self._tasks.values())

    async def run_crawl(
        self,
        seeds: list[str],
        max_depth: int = 3,
        max_pages: int = 100,
        external_domains: bool = False,
    ) -> Task:
        engine_dir = self._engine_dir()
        binary = self._find_binary("crawler")
        if not binary:
            return self._fail_task("Crawler binary not found — build the engine first")

        cmd = [
            binary,
            "--seeds",
            *seeds,
            "--max-depth",
            str(max_depth),
            "--max-pages",
            str(max_pages),
            "--skip-politeness",
        ]
        if external_domains:
            cmd.append("--external-domains")

        task_id = uuid.uuid4().hex[:12]
        task = Task(
            id=task_id,
            command=" ".join(cmd),
            status="running",
            started_at=datetime.now(UTC),
        )
        self._tasks[task_id] = task

        asyncio.create_task(self._run_process(task, cmd, cwd=engine_dir))
        return task

    async def run_reindex(self, max_pages: int | None = None) -> Task:
        engine_dir = self._engine_dir()
        binary = self._find_binary("indexer")
        if not binary:
            return self._fail_task("Indexer binary not found — build the engine first")

        index_dir = os.path.join(engine_dir, "data", "index")
        cmd = [binary, "--index-dir", index_dir, "reindex"]

        task_id = uuid.uuid4().hex[:12]
        task = Task(
            id=task_id,
            command=" ".join(cmd),
            status="running",
            started_at=datetime.now(UTC),
        )
        self._tasks[task_id] = task

        asyncio.create_task(self._run_process(task, cmd, cwd=engine_dir))
        return task

    async def _run_process(self, task: Task, cmd: list[str], cwd: str) -> None:
        logger.info("Starting task", extra={"task_id": task.id, "cmd": " ".join(cmd)})
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            task.stdout = stdout.decode(errors="replace")
            task.stderr = stderr.decode(errors="replace")
            task.return_code = proc.returncode
            task.status = "completed" if proc.returncode == 0 else "failed"
            if proc.returncode != 0:
                task.error = f"Exit code {proc.returncode}"
        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            logger.error("Task failed", extra={"task_id": task.id, "error": str(e)})
        finally:
            task.finished_at = datetime.now(UTC)
            logger.info(
                "Task finished",
                extra={"task_id": task.id, "status": task.status, "return_code": task.return_code},
            )

    def _find_binary(self, name: str) -> str | None:
        engine_dir = self._engine_dir()
        for sub in ("release", "debug"):
            path = os.path.join(engine_dir, "target", sub, name)
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
        return None

    def _engine_dir(self) -> str:
        return os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "engine"),
        )

    def _fail_task(self, message: str) -> Task:
        task = Task(
            id="error",
            command="",
            status="failed",
            started_at=datetime.now(UTC),
            error=message,
        )
        return task
