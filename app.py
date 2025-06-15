from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)


DATABASE = os.path.expanduser('~/database/demo.db')
def get_db_connection():
    if not os.path.exists(DATABASE):
        print(f"Error: Database file '{DATABASE}' not found.")
        return None
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        print(f"Database connection error: {e}")
        return None

def calculate_date_range(range_str):
    """Converts a human-readable range into a (start, end) tuple."""
    today = datetime.today()
    if range_str == '7d':
        return (today - timedelta(days=7), today)
    elif range_str == '30d':
        return (today - timedelta(days=30), today)
    elif range_str == '6mo':
        return (today - timedelta(days=182), today)
    elif range_str == '1yr':
        return (today - timedelta(days=365), today)
    else:
        # Default to Q2 2025 if no valid range is provided
        return (datetime(2025, 4, 1), datetime(2025, 7, 1))

@app.route('/api/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    range_str = request.args.get('range', '')
    start_date, end_date = calculate_date_range(range_str)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    query = """
    WITH RECURSIVE EnterpriseHierarchy AS (
        SELECT id FROM entities WHERE name = 'My Global Enterprise' AND type = 'enterprise'
        UNION ALL
        SELECT e.id FROM entities e
        JOIN EnterpriseHierarchy eh ON e.parent_id = eh.id
    )
    SELECT
        SUM(ccr.cost) AS total_enterprise_ci_cd_cost,
        SUM(CASE WHEN ccr.status = 'failed' THEN ccr.cost ELSE 0 END) AS total_failed_build_cost_enterprise,
        COUNT(ccr.id) AS total_runs_enterprise,
        SUM(CASE WHEN ccr.status = 'success' THEN 1 ELSE 0 END) AS successful_runs_enterprise,
        SUM(CASE WHEN ccr.status = 'failed' THEN 1 ELSE 0 END) AS failed_runs_enterprise
    FROM ci_cd_runs ccr
    JOIN repositories r ON ccr.repository_id = r.id
    JOIN entities e ON r.entity_id = e.id
    WHERE e.id IN (SELECT id FROM EnterpriseHierarchy)
      AND ccr.start_time >= ? AND ccr.start_time < ?;
    """
    try:
        cursor = conn.execute(query, (start_str, end_str))
        row = cursor.fetchone()
        summary_data = dict(row) if row else {}
        return jsonify(summary_data)
    except sqlite3.Error as e:
        print(f"Error executing dashboard-summary query: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()
@app.route('/api/platform-costs', methods=['GET'])
def get_platform_costs():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    range_str = request.args.get('range', '')
    start_date, end_date = calculate_date_range(range_str)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    query = """
    SELECT
      LOWER(ccr.platform) AS platform,
      SUM(ccr.cost) AS total_cost_by_platform,
      SUM(CASE WHEN ccr.status = 'failed' THEN ccr.cost ELSE 0 END) AS failed_cost_by_platform,
      COUNT(ccr.id) AS total_jobs,
      SUM(CASE WHEN ccr.status = 'success' THEN 1 ELSE 0 END) AS successful_jobs,
      SUM(CASE WHEN ccr.status = 'failed' THEN 1 ELSE 0 END) AS failed_jobs,
      ROUND(CAST(SUM(CASE WHEN ccr.status = 'success' THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(ccr.id), 2) AS success_rate_percent
    FROM ci_cd_runs ccr
    WHERE ccr.start_time >= ? AND ccr.start_time < ?
    GROUP BY platform
    ORDER BY total_cost_by_platform DESC;
    """
    try:
        cursor = conn.execute(query, (start_str, end_str))
        platform_data = [dict(row) for row in cursor.fetchall()]
        return jsonify(platform_data)
    except sqlite3.Error as e:
        print(f"Error executing platform-costs query: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()
        
@app.route('/api/platform-summary', methods=['GET'])
def get_platform_summary():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    platform = request.args.get('platform', '').lower()
    range_str = request.args.get('range', '')
    if not platform:
        return jsonify({"error": "Platform is required"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    try:
        # Summary: total cost, total jobs, failed jobs
        summary_query = """
        SELECT
          SUM(ccr.cost) AS total_cost,
          COUNT(ccr.id) AS total_jobs,
          SUM(CASE WHEN ccr.status = 'failed' THEN 1 ELSE 0 END) AS failed_jobs
        FROM ci_cd_runs ccr
        WHERE LOWER(ccr.platform) = ?
          AND ccr.start_time >= ? AND ccr.start_time < ?;
        """
        summary_row = conn.execute(summary_query, (platform, start_str, end_str)).fetchone()

        # Most costly repo
        repo_query = """
        SELECT r.name AS repo_name, SUM(ccr.cost) AS repo_cost
        FROM ci_cd_runs ccr
        JOIN repositories r ON ccr.repository_id = r.id
        WHERE LOWER(ccr.platform) = ?
          AND ccr.start_time >= ? AND ccr.start_time < ?
        GROUP BY r.id
        ORDER BY repo_cost DESC
        LIMIT 1;
        """
        repo_row = conn.execute(repo_query, (platform, start_str, end_str)).fetchone()

        response = {
            "platform": platform,
            "total_cost": summary_row["total_cost"] if summary_row else 0,
            "total_jobs": summary_row["total_jobs"] if summary_row else 0,
            "failed_jobs": summary_row["failed_jobs"] if summary_row else 0,
            "most_costly_repo": repo_row["repo_name"] if repo_row else None,
            "most_costly_repo_cost": repo_row["repo_cost"] if repo_row else 0
        }

        return jsonify(response)

    except sqlite3.Error as e:
        print(f"Error fetching platform summary: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()
@app.route('/api/platform-teams-summary', methods=['GET'])
def get_platform_teams_summary():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    platform = request.args.get('platform', '').lower()
    range_str = request.args.get('range', '')
    if not platform:
        return jsonify({"error": "Platform is required"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str, end_str = start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    # Decide entity types per platform
    if platform == 'bitbucket':
        entity_types = ("workspace",)
    else:
        entity_types = ("team", "group", "subgroup")

    # Prepare placeholders for SQL IN clause dynamically
    placeholders = ','.join(['?'] * len(entity_types))

    try:
        most_costly_team_query = f"""
        SELECT e.name AS team_name, SUM(ccr.cost) AS total_cost
        FROM entities e
        JOIN repositories r ON r.entity_id = e.id AND r.is_active = 1
        LEFT JOIN ci_cd_runs ccr ON ccr.repository_id = r.id
            AND LOWER(ccr.platform) = ?
            AND ccr.start_time >= ? AND ccr.start_time < ?
        WHERE e.platform = ? AND e.type IN ({placeholders})
        GROUP BY e.id
        ORDER BY total_cost DESC
        LIMIT 1;
        """

        most_jobs_team_query = f"""
        SELECT e.name AS team_name, COUNT(ccr.id) AS total_jobs
        FROM entities e
        JOIN repositories r ON r.entity_id = e.id AND r.is_active = 1
        LEFT JOIN ci_cd_runs ccr ON ccr.repository_id = r.id
            AND LOWER(ccr.platform) = ?
            AND ccr.start_time >= ? AND ccr.start_time < ?
        WHERE e.platform = ? AND e.type IN ({placeholders})
        GROUP BY e.id
        ORDER BY total_jobs DESC
        LIMIT 1;
        """

        most_failed_jobs_team_query = f"""
        SELECT e.name AS team_name, COUNT(ccr.id) AS failed_jobs
        FROM entities e
        JOIN repositories r ON r.entity_id = e.id AND r.is_active = 1
        LEFT JOIN ci_cd_runs ccr ON ccr.repository_id = r.id
            AND LOWER(ccr.platform) = ?
            AND ccr.start_time >= ? AND ccr.start_time < ?
            AND ccr.status = 'failed'
        WHERE e.platform = ? AND e.type IN ({placeholders})
        GROUP BY e.id
        ORDER BY failed_jobs DESC
        LIMIT 1;
        """

        total_teams_query = f"""
        SELECT COUNT(DISTINCT e.id) AS total_teams
        FROM entities e
        JOIN repositories r ON r.entity_id = e.id AND r.is_active = 1
        WHERE e.platform = ? AND e.type IN ({placeholders});
        """

        total_cost_query = """
        SELECT SUM(ccr.cost) AS total_cost
        FROM ci_cd_runs ccr
        WHERE LOWER(ccr.platform) = ? AND ccr.start_time >= ? AND ccr.start_time < ?;
        """

        total_jobs_query = f"""
        SELECT COUNT(ccr.id) AS total_jobs_count
        FROM ci_cd_runs ccr
        JOIN repositories r ON ccr.repository_id = r.id AND r.is_active = 1
        JOIN entities e ON r.entity_id = e.id
        WHERE LOWER(ccr.platform) = ? 
            AND ccr.start_time >= ? AND ccr.start_time < ?
            AND e.platform = ? AND e.type IN ({placeholders});
        """

        # Params for queries with entity types
        params_with_types = (platform, start_str, end_str, platform, *entity_types)
        params_total_jobs = (platform, start_str, end_str, platform, *entity_types)

        most_costly = conn.execute(most_costly_team_query, params_with_types).fetchone()
        most_jobs = conn.execute(most_jobs_team_query, params_with_types).fetchone()
        most_failed = conn.execute(most_failed_jobs_team_query, params_with_types).fetchone()
        total_teams = conn.execute(total_teams_query, (platform, *entity_types)).fetchone()
        total_cost = conn.execute(total_cost_query, (platform, start_str, end_str)).fetchone()
        total_jobs = conn.execute(total_jobs_query, params_total_jobs).fetchone()

        response = {
            "platform": platform,
            "most_costly_team": most_costly["team_name"] if most_costly else None,
            "most_costly_team_cost": most_costly["total_cost"] if most_costly else 0,
            "team_with_most_jobs": most_jobs["team_name"] if most_jobs else None,
            "team_with_most_jobs_count": most_jobs["total_jobs"] if most_jobs else 0,
            "team_with_most_failed_jobs": most_failed["team_name"] if most_failed else None,
            "team_with_most_failed_jobs_count": most_failed["failed_jobs"] if most_failed else 0,
            "total_active_teams": total_teams["total_teams"] if total_teams else 0,
            "total_cost": total_cost["total_cost"] if total_cost else 0,
            "total_jobs_count": total_jobs["total_jobs_count"] if total_jobs else 0,
        }

        return jsonify(response)

    except sqlite3.Error as e:
        print(f"Error fetching team summary: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()

        
@app.route('/api/platform-teams', methods=['GET'])
def get_platform_teams():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    platform = request.args.get('platform', '').lower()
    range_str = request.args.get('range', '')
    sort_by = request.args.get('sort_by', 'total_cost')

    if not platform:
        return jsonify({"error": "Platform is required"}), 400

    if sort_by not in ['total_cost', 'total_jobs']:
        return jsonify({"error": "Invalid sort_by field"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str, end_str = start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    # Map platform to team entity types
    platform_team_types = {
        "github": ["team"],
        "gitlab": ["group", "subgroup"],
        "bitbucket": ["workspace", "project"]
    }

    team_types = platform_team_types.get(platform)
    if not team_types:
        return jsonify({"error": f"Unsupported platform: {platform}"}), 400

    placeholders = ','.join(['?'] * len(team_types))

    try:
        query = f"""
        WITH RECURSIVE team_tree AS (
            SELECT id, name, parent_id, 0 as depth
            FROM entities
            WHERE platform = ? AND type IN ({placeholders})
            UNION ALL
            SELECT e.id, e.name, e.parent_id, tt.depth + 1
            FROM entities e
            JOIN team_tree tt ON e.parent_id = tt.id
            WHERE e.platform = ? AND e.type IN ({placeholders})
        ),
        team_tree_deduped AS (
            SELECT id, name, parent_id, MAX(depth) as depth
            FROM team_tree
            GROUP BY id
        ),
        team_jobs AS (
            SELECT 
                tt.id as team_id,
                COUNT(ccr.id) as total_jobs,
                SUM(IFNULL(ccr.cost, 0.0)) as total_cost
            FROM team_tree_deduped tt
            LEFT JOIN repositories r ON r.entity_id = tt.id
            LEFT JOIN ci_cd_runs ccr ON ccr.repository_id = r.id
            WHERE LOWER(ccr.platform) = ?
              AND ccr.start_time >= ? AND ccr.start_time < ?
            GROUP BY tt.id
        ),
        team_repos AS (
            SELECT e.id as team_id, GROUP_CONCAT(DISTINCT r.name) as repos
            FROM repositories r
            JOIN entities e ON r.entity_id = e.id
            GROUP BY e.id
        )
        SELECT
            tt.name AS team_name,
            (SELECT name FROM entities WHERE id = tt.parent_id) AS parent_team_name,
            COALESCE(tj.total_jobs, 0) AS total_jobs,
            COALESCE(tj.total_cost, 0.0) AS total_cost,
            COALESCE(tt.depth, 0) AS depth,
            COALESCE(tr.repos, '') AS repositories
        FROM team_tree_deduped tt
        LEFT JOIN team_jobs tj ON tj.team_id = tt.id
        LEFT JOIN team_repos tr ON tr.team_id = tt.id
        ORDER BY {sort_by} DESC;
        """

        params = [platform] + team_types + [platform] + team_types + [platform, start_str, end_str]

        cursor = conn.execute(query, params)
        rows = cursor.fetchall()

        result = []
        for row in rows:
            d = dict(row)
            d['repositories'] = d['repositories'].split(',') if d['repositories'] else []
            result.append(d)

        return jsonify(result)

    except sqlite3.Error as e:
        print(f"Error fetching teams: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()

        
@app.route('/api/platform-repositories-summary', methods=['GET'])
def get_platform_repositories_summary():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    platform = request.args.get('platform', '').lower()
    range_str = request.args.get('range', '')
    if not platform:
        return jsonify({"error": "Platform is required"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str, end_str = start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    try:
        # Most costly repository
        most_costly_query = """
        SELECT r.name AS repo_name, SUM(ccr.cost) AS total_cost
        FROM ci_cd_runs ccr
        JOIN repositories r ON r.id = ccr.repository_id
        WHERE LOWER(ccr.platform) = ? AND ccr.start_time >= ? AND ccr.start_time < ?
        GROUP BY r.id
        ORDER BY total_cost DESC
        LIMIT 1;
        """

        # Most active repository
        most_jobs_query = """
        SELECT r.name AS repo_name, COUNT(ccr.id) AS total_jobs
        FROM ci_cd_runs ccr
        JOIN repositories r ON r.id = ccr.repository_id
        WHERE LOWER(ccr.platform) = ? AND ccr.start_time >= ? AND ccr.start_time < ?
        GROUP BY r.id
        ORDER BY total_jobs DESC
        LIMIT 1;
        """

        # Total active repositories
        total_repos_query = """
        SELECT COUNT(*) AS total_repos
        FROM repositories
        WHERE LOWER(platform) = ? AND is_active = 1;
        """

        # Total cost for platform
        total_cost_query = """
        SELECT SUM(ccr.cost) AS total_cost
        FROM ci_cd_runs ccr
        WHERE LOWER(ccr.platform) = ? AND ccr.start_time >= ? AND ccr.start_time < ?;
        """

        most_costly = conn.execute(most_costly_query, (platform, start_str, end_str)).fetchone()
        most_jobs = conn.execute(most_jobs_query, (platform, start_str, end_str)).fetchone()
        total_repos = conn.execute(total_repos_query, (platform,)).fetchone()
        total_cost = conn.execute(total_cost_query, (platform, start_str, end_str)).fetchone()

        response = {
            "platform": platform,
            "most_costly_repo": most_costly["repo_name"] if most_costly else None,
            "most_costly_repo_cost": most_costly["total_cost"] if most_costly else 0,
            "repo_with_most_jobs": most_jobs["repo_name"] if most_jobs else None,
            "repo_with_most_jobs_count": most_jobs["total_jobs"] if most_jobs else 0,
            "total_active_repositories": total_repos["total_repos"] if total_repos else 0,
            "total_cost": total_cost["total_cost"] if total_cost else 0,
        }

        return jsonify(response)

    except sqlite3.Error as e:
        print(f"Error fetching repository summary: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()

@app.route('/api/platform-repositories', methods=['GET'])
def get_platform_repositories():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    platform = request.args.get('platform', '').lower()
    range_str = request.args.get('range', '')
    sort_by = request.args.get('sort_by', 'total_cost')

    if not platform:
        return jsonify({"error": "Platform is required"}), 400

    if sort_by not in ['total_cost', 'total_jobs']:
        return jsonify({"error": "Invalid sort_by field"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str, end_str = start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    try:
        query = f"""
        SELECT 
            r.name AS repo_name,
            e.name AS team_name,
            COUNT(ccr.id) AS total_jobs,
            COALESCE(SUM(ccr.cost), 0.0) AS total_cost
        FROM repositories r
        JOIN entities e ON r.entity_id = e.id
        LEFT JOIN ci_cd_runs ccr ON r.id = ccr.repository_id
            AND LOWER(ccr.platform) = ?
            AND ccr.start_time >= ? AND ccr.start_time < ?
        WHERE LOWER(r.platform) = ? AND r.is_active = 1
        GROUP BY r.id
        ORDER BY {sort_by} DESC;
        """
        cursor = conn.execute(query, (platform, start_str, end_str, platform))
        repos = [dict(row) for row in cursor.fetchall()]

        return jsonify(repos)

    except sqlite3.Error as e:
        print(f"Error fetching repository list: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()
        
        
@app.route('/api/teams', methods=['GET'])
def get_global_teams():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    range_str = request.args.get('range', '')
    sort_by = request.args.get('sort_by', 'total_cost')

    valid_sort_fields = ["total_cost", "total_jobs"]
    if sort_by not in valid_sort_fields:
        return jsonify({"error": f"Invalid sort_by. Use one of {valid_sort_fields}"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    try:
        query = f"""
        WITH RECURSIVE team_tree AS (
            SELECT id, name, parent_id, platform, type, 0 AS depth
            FROM entities
            WHERE type IN ('team', 'group', 'subgroup', 'workspace', 'project')
            UNION ALL
            SELECT e.id, e.name, e.parent_id, e.platform, e.type, tt.depth + 1
            FROM entities e
            JOIN team_tree tt ON e.parent_id = tt.id
        ),
        team_tree_deduped AS (
            SELECT id, name, parent_id, platform, type, MAX(depth) as depth
            FROM team_tree
            GROUP BY id
        ),
        team_jobs AS (
            SELECT 
                tt.id as team_id,
                COUNT(ccr.id) as total_jobs,
                SUM(IFNULL(ccr.cost, 0.0)) as total_cost
            FROM team_tree_deduped tt
            LEFT JOIN repositories r ON r.entity_id = tt.id
            LEFT JOIN ci_cd_runs ccr ON ccr.repository_id = r.id
                AND ccr.start_time >= ? AND ccr.start_time < ?
            GROUP BY tt.id
        ),
        team_repos AS (
            SELECT r.entity_id as team_id, GROUP_CONCAT(DISTINCT r.name) as repos
            FROM repositories r
            GROUP BY r.entity_id
        )
        SELECT
            tt.name AS team_name,
            tt.platform AS platform,
            tt.type AS entity_type,
            (SELECT name FROM entities WHERE id = tt.parent_id) AS parent_team_name,
            COALESCE(tj.total_jobs, 0) AS total_jobs,
            COALESCE(tj.total_cost, 0.0) AS total_cost,
            COALESCE(tt.depth, 0) AS depth,
            COALESCE(tr.repos, '') AS repositories
        FROM team_tree_deduped tt
        LEFT JOIN team_jobs tj ON tj.team_id = tt.id
        LEFT JOIN team_repos tr ON tr.team_id = tt.id
        ORDER BY {sort_by} DESC;
        """

        params = [start_str, end_str]
        cursor = conn.execute(query, params)
        result = [dict(row) for row in cursor.fetchall()]
        for r in result:
            r["repositories"] = r["repositories"].split(',') if r["repositories"] else []

        return jsonify(result)

    except sqlite3.Error as e:
        print(f"Error fetching global teams: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()
        

@app.route('/api/repositories', methods=['GET'])
def get_global_repositories():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Failed to connect to database."}), 500

    range_str = request.args.get('range', '')
    sort_by = request.args.get('sort_by', 'total_cost')

    valid_sort_fields = ["total_cost", "total_jobs"]
    if sort_by not in valid_sort_fields:
        return jsonify({"error": f"Invalid sort_by. Use one of {valid_sort_fields}"}), 400

    start_date, end_date = calculate_date_range(range_str)
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    try:
        query = f"""
        SELECT 
            r.name AS repo_name,
            e.name AS team_name,
            LOWER(r.platform) AS platform,
            COUNT(ccr.id) AS total_jobs,
            COALESCE(SUM(ccr.cost), 0.0) AS total_cost
        FROM repositories r
        JOIN entities e ON r.entity_id = e.id
        LEFT JOIN ci_cd_runs ccr 
            ON r.id = ccr.repository_id
            AND ccr.start_time >= ? AND ccr.start_time < ?
        WHERE r.is_active = 1
        GROUP BY r.id
        ORDER BY {sort_by} DESC
        """

        cursor = conn.execute(query, (start_str, end_str))
        repos = [dict(row) for row in cursor.fetchall()]

        summary = {
            "most_expensive_repo": max(repos, key=lambda r: r["total_cost"])["repo_name"] if repos else None,
            "most_jobs_repo": max(repos, key=lambda r: r["total_jobs"])["repo_name"] if repos else None,
            "cheapest_repo": min(repos, key=lambda r: r["total_cost"])["repo_name"] if repos else None,
        }

        return jsonify({"repositories": repos, "summary": summary})

    except sqlite3.Error as e:
        print(f"Error fetching repositories: {e}")
        return jsonify({"error": f"Database query error: {e}"}), 500
    finally:
        conn.close()

       


# --- Run the Flask App ---
if __name__ == '__main__':
    app.run(debug=True)
