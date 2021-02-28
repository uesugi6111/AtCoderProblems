import React from "react";
import { Alert, Nav, NavItem, NavLink, Row, Spinner } from "reactstrap";
import { NavLink as RouterLink, useLocation } from "react-router-dom";

import { List, Map as ImmutableMap } from "immutable";
import { connect, PromiseState } from "react-refetch";
import * as CachedApiClient from "../../utils/CachedApiClient";
import { RatingInfo, ratingInfoOf } from "../../utils/RatingInfo";
import { convertMap } from "../../utils/ImmutableMigration";
import { generatePathWithParams } from "../../utils/QueryString";
import { isLoggedIn } from "../../utils/UserState";
import { caseInsensitiveUserId } from "../../utils";
import Submission from "../../interfaces/Submission";
import MergedProblem from "../../interfaces/MergedProblem";
import Contest from "../../interfaces/Contest";
import { ContestId, ProblemId } from "../../interfaces/Status";
import ProblemModel from "../../interfaces/ProblemModel";
import { UserNameLabel } from "../../components/UserNameLabel";
import { UserResponse } from "../Internal/types";
import { USER_GET } from "../Internal/ApiUrl";
import { PieChartBlock } from "./PieChartBlock";
import { AchievementBlock } from "./AchievementBlock";
import { ProgressChartBlock } from "./ProgressChartBlock";
import { Recommendations } from "./Recommendations";
import { LanguageCount } from "./LanguageCount";
import { DifficultyPieChart } from "./DifficultyPieChart";
import { TrophyBlock } from "./TrophyBlock/TrophyBlock";
import { Submissions } from "./Submissions";
import * as UserUtil from "./UserUtils";

const userPageTabs = [
  "Achievement",
  "AtCoder Pie Charts",
  "Difficulty Pies",
  "Progress Charts",
  "Submissions",
  "Recommendation",
  "Languages",
  "Trophy",
  "All",
] as const;

const TAB_PARAM = "userPageTab";

type UserPageTab = typeof userPageTabs[number];

interface OuterProps {
  userId: string;
}

interface InnerProps extends OuterProps {
  userRatingInfoFetch: PromiseState<RatingInfo>;
  mergedProblemsFetch: PromiseState<ImmutableMap<ProblemId, MergedProblem>>;
  submissionsFetch: PromiseState<ImmutableMap<ProblemId, List<Submission>>>;
  contestsFetch: PromiseState<ImmutableMap<ContestId, Contest>>;
  problemModelsFetch: PromiseState<ImmutableMap<ProblemId, ProblemModel>>;
  loginState: PromiseState<UserResponse | null>;
}

const InnerUserPage: React.FC<InnerProps> = (props) => {
  const location = useLocation();
  const param = new URLSearchParams(location.search).get(TAB_PARAM);
  const userPageTab: UserPageTab =
    userPageTabs.find((t) => t === param) || "Achievement";

  const {
    userId,
    userRatingInfoFetch,
    submissionsFetch,
    mergedProblemsFetch,
    contestsFetch,
    problemModelsFetch,
  } = props;

  if (submissionsFetch.pending) {
    return <Spinner style={{ width: "3rem", height: "3rem" }} />;
  }

  const userRatingInfo = userRatingInfoFetch.fulfilled
    ? userRatingInfoFetch.value
    : ratingInfoOf(List());
  const mergedProblems = mergedProblemsFetch.fulfilled
    ? mergedProblemsFetch.value
    : ImmutableMap<ProblemId, MergedProblem>();
  const contests = contestsFetch.fulfilled
    ? contestsFetch.value
    : ImmutableMap<string, Contest>();
  const problemModels = problemModelsFetch.fulfilled
    ? problemModelsFetch.value
    : ImmutableMap<ProblemId, ProblemModel>();
  const submissions = submissionsFetch.fulfilled
    ? submissionsFetch.value
    : ImmutableMap<ProblemId, List<Submission>>();

  if (userId.length === 0 || submissions.isEmpty()) {
    return <Alert color="danger">User not found!</Alert>;
  }

  /* eslint-disable */
  const actualUserId = (() => {
    for (const subs of Array.from(submissions.values())) {
      for (const s of Array.from(subs)) {
        if (caseInsensitiveUserId(s.user_id) == userId) {
          return s.user_id;
        }
      }
    }
    return userId;
  })();
  /* eslint-disable */

  const userSubmissions = UserUtil.userSubmissions(
    convertMap(submissions.map((list) => list.toArray())),
    userId
  );

  return (
    <div>
      <Row className="my-2 border-bottom">
        <UserNameLabel userId={actualUserId} big showRating />
      </Row>
      <Nav tabs>
        {userPageTabs.map((tab) => (
          <NavItem key={tab}>
            <NavLink
              tag={RouterLink}
              isActive={(): boolean => tab === userPageTab}
              to={generatePathWithParams(location, { [TAB_PARAM]: tab })}
            >
              {tab}
            </NavLink>
          </NavItem>
        ))}
      </Nav>
      {(userPageTab === "All" || userPageTab === "Achievement") && (
        <AchievementBlock userId={userId} />
      )}
      {(userPageTab === "All" || userPageTab === "AtCoder Pie Charts") && (
        <PieChartBlock userId={userId} />
      )}
      {(userPageTab === "All" || userPageTab === "Difficulty Pies") && (
        <>
          <Row className="my-2 border-bottom">
            <h1>Difficulty Pies</h1>
          </Row>
          <DifficultyPieChart userId={userId} />
        </>
      )}
      {(userPageTab === "All" || userPageTab === "Progress Charts") && (
        <ProgressChartBlock userId={userId} />
      )}
      {(userPageTab === "All" || userPageTab === "Submissions") && (
        <>
          <Row className="my-2 border-bottom">
            <h1>Submissions</h1>
          </Row>
          <Submissions userId={userId} />
        </>
      )}
      {(userPageTab === "All" || userPageTab === "Languages") && (
        <>
          <Row className="my-2 border-bottom">
            <h1>Languages</h1>
          </Row>
          <LanguageCount userId={userId} />
        </>
      )}
      {(userPageTab === "All" || userPageTab === "Trophy") && (
        <>
          <Row className="my-2 border-bottom">
            <h1>Trophy [beta]</h1>
          </Row>
          <TrophyBlock userId={userId} />
        </>
      )}
      {(userPageTab === "All" || userPageTab === "Recommendation") && (
        <>
          <Row className="my-2 border-bottom">
            <h1>Recommendation</h1>
          </Row>
          <Recommendations
            userSubmissions={userSubmissions}
            problems={mergedProblems.valueSeq().toList()}
            contests={contests}
            problemModels={problemModels}
            userRatingInfo={userRatingInfo}
            isLoggedIn={isLoggedIn(props.loginState)}
          />
        </>
      )}
    </div>
  );
};

export const UserPage = connect<OuterProps, InnerProps>(({ userId }) => ({
  submissionsFetch: {
    comparison: userId,
    value: (): Promise<ImmutableMap<string, List<Submission>>> =>
      CachedApiClient.cachedUsersSubmissionMap(List([userId])),
  },
  mergedProblemsFetch: {
    comparison: null,
    value: (): Promise<ImmutableMap<string, MergedProblem>> =>
      CachedApiClient.cachedMergedProblemMap(),
  },
  problemModelsFetch: {
    comparison: null,
    value: (): Promise<ImmutableMap<string, ProblemModel>> =>
      CachedApiClient.cachedProblemModels(),
  },
  contestsFetch: {
    comparison: null,
    value: (): Promise<ImmutableMap<string, Contest>> =>
      CachedApiClient.cachedContestMap(),
  },
  userRatingInfoFetch: {
    comparison: userId,
    value: (): Promise<RatingInfo> => CachedApiClient.cachedRatingInfo(userId),
  },
  loginState: USER_GET,
}))(InnerUserPage);
