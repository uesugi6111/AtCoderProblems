use std::env;

use actix_web::{http, server, App, HttpRequest, HttpResponse};
use regex::Regex;

use atcoder_problems_api_server::config::Config;
use atcoder_problems_api_server::sql::*;
use atcoder_problems_api_server::UserInfo;

trait UserNameExtractor {
    fn extract_user(&self) -> String;
}

impl<T> UserNameExtractor for HttpRequest<T> {
    fn extract_user(&self) -> String {
        self.query()
            .get("user")
            .filter(|user| Regex::new("[a-zA-Z0-9_]+").unwrap().is_match(user))
            .map(|user| user.clone())
            .unwrap_or("".to_owned())
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let config = Config::create_from_file(&args[1]).unwrap();

    server::new(move || {
        App::with_state(config.clone())
            .route("/results", http::Method::GET, result_api)
            .route("/v2/user_info", http::Method::GET, user_info_api)
    })
    .bind("127.0.0.1:8080")
    .unwrap()
    .run();
}

fn result_api(request: HttpRequest<Config>) -> HttpResponse {
    let user = request.extract_user();
    match get_connection(
        &request.state().postgresql_user,
        &request.state().postgresql_pass,
        &request.state().postgresql_host,
    )
    .and_then(|conn| get_submissions(&user, &conn))
    {
        Ok(submission) => HttpResponse::Ok().json(submission),
        _ => HttpResponse::new(http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

fn user_info_api(request: HttpRequest<Config>) -> HttpResponse {
    let user_id = request.extract_user();
    match get_user_info(request.state(), user_id) {
        Ok(user_info) => HttpResponse::Ok().json(user_info),
        _ => HttpResponse::new(http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

fn get_user_info(config: &Config, user_id: String) -> Result<UserInfo, String> {
    let conn = get_connection(
        &config.postgresql_user,
        &config.postgresql_pass,
        &config.postgresql_host,
    )?;
    let (accepted_count, accepted_count_rank) =
        get_count_rank::<i32>(&user_id, &conn, "accepted_count", "problem_count", 0)?;
    let (rated_point_sum, rated_point_sum_rank) =
        get_count_rank::<f64>(&user_id, &conn, "rated_point_sum", "point_sum", 0.0)?;
    Ok(UserInfo {
        user_id,
        accepted_count,
        accepted_count_rank,
        rated_point_sum,
        rated_point_sum_rank,
    })
}
