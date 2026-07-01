@echo off
setlocal enabledelayedexpansion

set "QWRY_DIR=%~dp0"
set "CONFIG=%QWRY_DIR%qwry.toml"

if "%~1"=="" goto usage
if "%~1"=="help" goto usage
if "%~1"=="--help" goto usage
if "%~1"=="-h" goto usage

set "CMD=%~1"
shift

if /i "%CMD%"=="crawl"    goto crawl
if /i "%CMD%"=="index"    goto index
if /i "%CMD%"=="reindex"  goto reindex
if /i "%CMD%"=="search"   goto search
if /i "%CMD%"=="serve"    goto serve
if /i "%CMD%"=="pipeline" goto pipeline
echo Unknown command: %CMD%
goto usage

:get_cfg
rem %1 = section, %2 = key, %3 = default
if not exist "%CONFIG%" (
    echo %~3
    exit /b
)
for /f "tokens=*" %%A in ('findstr /r /c:"^\[%~1\]" "%CONFIG%"') do (
    set "section_found=1"
)
if not defined section_found (
    echo %~3
    exit /b
)
for /f "tokens=1,* delims==" %%A in ('findstr /r /c:"^%~2 = " "%CONFIG%"') do (
    set "val=%%B"
    set "val=!val: =!"
    set "val=!val:"=!"
    if defined val (
        echo !val!
        exit /b
    )
)
echo %~3
exit /b

:crawl
set "seeds="
:parse_crawl
if "%~1"=="" goto do_crawl
if "%~1"=="--seeds" (
    shift
    :parse_seeds
    if "%~1"=="" goto do_crawl
    if "%~1"=="--" goto do_crawl
    if "%~1:~0,2"=="--" (
        set "extra_args=!extra_args! %~1"
        shift
        goto parse_crawl
    )
    if defined seeds (
        set "seeds=!seeds! %~1"
    ) else (
        set "seeds=%~1"
    )
    shift
    goto parse_seeds
)
set "extra_args=!extra_args! %~1"
shift
goto parse_crawl

:do_crawl
if not defined seeds (
    echo ERROR: no seed URLs provided
    exit /b 1
)

for /f %%i in ('call :get_cfg crawler max_depth 3') do set "max_depth=%%i"
for /f %%i in ('call :get_cfg crawler concurrency 10') do set "concurrency=%%i"
for /f %%i in ('call :get_cfg crawler max_pages 100') do set "max_pages=%%i"
for /f %%i in ('call :get_cfg crawler politeness_delay_secs 1.0') do set "politeness=%%i"
for /f %%i in ('call :get_cfg crawler user_agent "QwryBot/0.1"') do set "ua=%%i"
for /f %%i in ('call :get_cfg crawler external_domains false') do set "ext_dom=%%i"
for /f %%i in ('call :get_cfg crawler max_retries 3') do set "retries=%%i"
for /f %%i in ('call :get_cfg crawler retry_base_delay_secs 5.0') do set "retry_delay=%%i"
for /f %%i in ('call :get_cfg crawler skip_politeness false') do set "skip_polite=%%i"
for /f %%i in ('call :get_cfg crawler batch_db_check_size 100') do set "batch_size=%%i"

set "crawl_flags=--max-depth !max_depth! --concurrency !concurrency! --max-pages !max_pages! --politeness-delay-secs !politeness! --user-agent !ua! --max-retries !retries! --retry-base-delay-secs !retry_delay! --batch-db-check-size !batch_size!"
if /i "!skip_polite!"=="true" set "crawl_flags=!crawl_flags! --skip-politeness"
if /i "!ext_dom!"=="true" set "crawl_flags=!crawl_flags! --external-domains"

echo === Starting crawl ===
cargo run --release --manifest-path "%QWRY_DIR%Cargo.toml" --bin crawler -- !crawl_flags! !extra_args! --seeds !seeds!
goto end

:index
for /f %%i in ('call :get_cfg index_dir path "./data/index"') do set "idx_dir=%%i"
echo === Indexing unindexed pages ===
set "index_flags=--index-dir !idx_dir!"
cargo run --release --manifest-path "%QWRY_DIR%Cargo.toml" --bin indexer -- !index_flags! index %*
goto end

:reindex
for /f %%i in ('call :get_cfg index_dir path "./data/index"') do set "idx_dir=%%i"
echo === Rebuilding index from scratch ===
set "index_flags=--index-dir !idx_dir!"
cargo run --release --manifest-path "%QWRY_DIR%Cargo.toml" --bin indexer -- !index_flags! reindex %*
goto end

:search
if "%~1"=="" (
    echo ERROR: search requires a query string
    exit /b 1
)
for /f %%i in ('call :get_cfg index_dir path "./data/index"') do set "idx_dir=%%i"
echo === Searching: %* ===
set "index_flags=--index-dir !idx_dir!"
cargo run --release --manifest-path "%QWRY_DIR%Cargo.toml" --bin indexer -- !index_flags! search %*
goto end

:serve
for /f %%i in ('call :get_cfg index_dir path "./data/index"') do set "idx_dir=%%i"
for /f %%i in ('call :get_cfg indexer port 8001') do set "port=%%i"
echo === Starting search API server on port !port! ===
set "index_flags=--index-dir !idx_dir!"
cargo run --release --manifest-path "%QWRY_DIR%Cargo.toml" --bin indexer -- !index_flags! serve --port !port! %*
goto end

:pipeline
echo ========== PIPELINE: CRAWL ==========
call :crawl %*
echo ========== PIPELINE: INDEX ==========
call :index
echo ========== PIPELINE DONE ==========
goto end

:usage
echo Usage: %~nx0 ^<command^> [options] [--seeds URL...^|args^]
echo.
echo Commands:
echo   crawl    --seeds URL...   Crawl pages from the given seed URLs
echo   index                      Index unindexed pages into Tantivy
echo   reindex                    Rebuild the Tantivy index from scratch
echo   search QUERY               Search the index
echo   serve                      Start the search API server
echo   pipeline --seeds URL...    crawl + index in one shot
echo.
echo Run 'cargo run --bin crawler -- --help' or 'cargo run --bin indexer -- --help'
echo for available flags. This script reads sensible defaults from qwry.toml.
goto end

:end
endlocal
